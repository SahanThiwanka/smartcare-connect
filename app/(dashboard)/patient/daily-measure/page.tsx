// app/(dashboard)/patient/daily-measure/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
// ADD at top with other imports
import { aiEvaluateDaily } from "@/lib/aiClient";

/* =========================
   Types & helpers
========================= */

type DailyMeasure = {
  date: string;

  // Legacy/raw strings (back-compat)
  pressure?: string; // e.g. "120/80"
  cholesterol?: string; // total
  sugar?: string; // fasting
  sugarPost?: string; // 2h post meal (optional)
  spo2?: string;
  exerciseTime?: string;
  temperature?: string;
  weight?: string; // kg
  height?: string; // cm
  waterIntake?: string; // L per day

  // Numeric, preferred
  systolic?: number;
  diastolic?: number;
  sugarMgDl?: number; // fasting
  sugarPostMgDl?: number; // 2h post
  cholesterolTotal?: number;
  spo2Pct?: number;
  exerciseMins?: number;
  temperatureC?: number;
  weightKg?: number;
  heightCm?: number;
  waterIntakeL?: number;

  // New metadata
  note?: string;
  source?: "patient" | "caregiver";
  addedByUid?: string;
  addedByRole?: "patient" | "caregiver" | "doctor" | "admin";
  addedByName?: string;

  createdAt?: Timestamp;
};

type Status = "Good" | "OK" | "Bad" | "Emergency";
type Risk = Status | "Unknown";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n =
    typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function parseBP(raw?: string): { systolic?: number; diastolic?: number } {
  if (!raw) return {};
  const m = raw.match(/(\d{2,3})\D+(\d{2,3})/);
  if (!m) return {};
  return { systolic: toNum(m[1]), diastolic: toNum(m[2]) };
}

function normalize(rec: DailyMeasure): DailyMeasure {
  const { systolic, diastolic } =
    rec.systolic != null && rec.diastolic != null
      ? { systolic: rec.systolic, diastolic: rec.diastolic }
      : parseBP(rec.pressure);

  return {
    ...rec,
    systolic,
    diastolic,
    sugarMgDl: rec.sugarMgDl ?? toNum(rec.sugar),
    sugarPostMgDl: rec.sugarPostMgDl ?? toNum(rec.sugarPost),
    cholesterolTotal: rec.cholesterolTotal ?? toNum(rec.cholesterol),
    spo2Pct: rec.spo2Pct ?? toNum(rec.spo2),
    exerciseMins: rec.exerciseMins ?? toNum(rec.exerciseTime),
    temperatureC: rec.temperatureC ?? toNum(rec.temperature),
    weightKg: rec.weightKg ?? toNum(rec.weight),
    heightCm: rec.heightCm ?? toNum(rec.height),
    waterIntakeL: rec.waterIntakeL ?? toNum(rec.waterIntake),
  };
}

function calcTightDomain(values: number[], minRange = 1): [number, number] {
  const nums = values.filter((v) => Number.isFinite(v)) as number[];
  if (!nums.length) return [0, 1];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = Math.max(max - min, minRange);
  const pad = span * 0.1;
  return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
}

/* =========================
   Status rules
========================= */

function statusBP(s?: number, d?: number): Status | undefined {
  if (s == null || d == null) return undefined;
  if (s > 180 || d > 120) return "Emergency";
  if (s < 120 && d < 80) return "Good";
  if (s >= 120 && s <= 129 && d < 80) return "OK";
  return "Bad"; // Hypertension Stage 1+ otherwise
}

function statusSugarFasting(mgdl?: number): Status | undefined {
  if (mgdl == null) return undefined;
  if (mgdl >= 70 && mgdl <= 99) return "Good";
  if (mgdl >= 100 && mgdl <= 125) return "OK";
  if (mgdl >= 126) return "Bad";
  return undefined;
}

function statusSugarPost(mgdl?: number): Status | undefined {
  if (mgdl == null) return undefined;
  if (mgdl <= 139) return "Good";
  if (mgdl >= 140 && mgdl <= 199) return "OK";
  if (mgdl >= 200) return "Bad";
  return undefined;
}

function statusCholTotal(mgdl?: number): Status | undefined {
  if (mgdl == null) return undefined;
  if (mgdl <= 199) return "Good";
  if (mgdl >= 200 && mgdl <= 239) return "OK";
  if (mgdl >= 240) return "Bad";
  return undefined;
}

function statusSpO2(pct?: number): Status | undefined {
  if (pct == null) return undefined;
  if (pct >= 95) return "Good";
  if (pct >= 90) return "OK";
  return "Bad"; // < 90
}

function statusTemp(c?: number): Status | undefined {
  if (c == null) return undefined;
  if (c >= 36.1 && c <= 37.2) return "Good";
  if ((c >= 37.3 && c <= 38.0) || c < 36.0) return "OK";
  if (c >= 38.1) return "Bad";
  return undefined;
}

function calcBMI(weightKg?: number, heightCm?: number): number | undefined {
  if (!weightKg || !heightCm) return undefined;
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  return Number.isFinite(bmi) ? Number(Math.round(bmi * 10) / 10) : undefined;
}

function statusBMI(bmi?: number): Status | undefined {
  if (bmi == null) return undefined;
  if (bmi >= 18.5 && bmi <= 24.9) return "Good";
  if ((bmi >= 25.0 && bmi <= 29.9) || bmi < 18.5) return "OK";
  if (bmi >= 30.0) return "Bad";
  return undefined;
}

// Water intake target: 0.03–0.035 L per kg
function waterTarget(
  weightKg?: number
): [number | undefined, number | undefined] {
  if (!weightKg) return [undefined, undefined];
  return [
    Number((0.03 * weightKg).toFixed(2)),
    Number((0.035 * weightKg).toFixed(2)),
  ];
}
function statusWater(actualL?: number, weightKg?: number): Status | undefined {
  if (actualL == null || !weightKg) return undefined;
  const [min, max] = waterTarget(weightKg);
  if (min == null || max == null) return undefined;
  if (actualL >= min && actualL <= max) return "Good";
  const slack = 0.25; // liters
  if (
    (actualL >= min - slack && actualL < min) ||
    (actualL > max && actualL <= max + slack)
  )
    return "OK";
  return "Bad";
}

/* =========================
   UI helpers
========================= */

function badge(status?: Status) {
  if (!status) return null;
  const map: Record<Status, string> = {
    Good: "bg-green-500/20 text-green-300 border-green-400/30",
    OK: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
    Bad: "bg-red-500/20 text-red-300 border-red-400/30",
    Emergency: "bg-red-700/30 text-red-200 border-red-500/50",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}

function delta(a?: number, b?: number) {
  if (a == null || b == null) return null;
  const d = a - b;
  if (!Number.isFinite(d) || d === 0) return null;
  const sign = d > 0 ? "▲" : "▼";
  return `${sign} ${Math.abs(Math.round(d * 10) / 10)}`;
}

function clampNum(name: string, val: number | undefined) {
  if (val == null || Number.isNaN(val)) return undefined;
  // Disallow negatives for these
  const nonNegative = new Set([
    "systolic",
    "diastolic",
    "sugarMgDl",
    "sugarPostMgDl",
    "cholesterolTotal",
    "spo2Pct",
    "exerciseMins",
    "weightKg",
    "heightCm",
    "waterIntakeL",
  ]);
  if (nonNegative.has(name) && val < 0) return 0;
  return val;
}

function coerceRisk(x: unknown): Risk {
  const allowed: Record<Risk, true> = {
    Good: true,
    OK: true,
    Bad: true,
    Emergency: true,
    Unknown: true,
  };
  return typeof x === "string" && (allowed as Record<string, true>)[x]
    ? (x as Risk)
    : "Unknown";
}

/* =========================
   Component
========================= */

type InputField = {
  name: keyof DailyMeasure;
  label: string;
  type: React.HTMLInputTypeAttribute;
  step?: string;
};

export default function DailyMeasurePage() {
  const { user, role, userDoc } = useAuth();
  const [form, setForm] = useState<DailyMeasure>({
    date: todayISO(),
  });
  const [records, setRecords] = useState<DailyMeasure[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ADD near other state
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [aiRisk, setAiRisk] = useState<Risk>("Unknown");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotified, setAiNotified] = useState<boolean>(false);

  const inputFields = useMemo<InputField[]>(
    () => [
      // Blood Pressure (numeric preferred)
      { name: "systolic", label: "Systolic (mmHg)", type: "number", step: "1" },
      {
        name: "diastolic",
        label: "Diastolic (mmHg)",
        type: "number",
        step: "1",
      },
      // Legacy optional field — keep if user types "120/80"
      { name: "pressure", label: "Blood Pressure (e.g. 120/80)", type: "text" },

      // Glucose (fasting + optional post)
      {
        name: "sugarMgDl",
        label: "Fasting Sugar (mg/dL)",
        type: "number",
        step: "1",
      },
      {
        name: "sugarPostMgDl",
        label: "2h Post Meal Sugar (mg/dL)",
        type: "number",
        step: "1",
      },

      // Lipids
      {
        name: "cholesterolTotal",
        label: "Total Cholesterol (mg/dL)",
        type: "number",
        step: "1",
      },

      // Vitals
      { name: "spo2Pct", label: "SpO₂ (%)", type: "number", step: "1" },
      {
        name: "temperatureC",
        label: "Temperature (°C)",
        type: "number",
        step: "0.1",
      },

      // Body & activity
      { name: "weightKg", label: "Weight (kg)", type: "number", step: "0.1" },
      { name: "heightCm", label: "Height (cm)", type: "number", step: "1" },
      {
        name: "exerciseMins",
        label: "Exercise Time (mins)",
        type: "number",
        step: "1",
      },

      // Water
      {
        name: "waterIntakeL",
        label: "Water Intake (L/day)",
        type: "number",
        step: "0.1",
      },
    ],
    []
  );

  const loadRecords = useCallback(async () => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "dailyMeasures"),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);
    const raw = snap.docs.map((d) => d.data() as DailyMeasure);
    const data = raw.map(normalize);
    setRecords(data.slice(0, 14)); // last 2 weeks
  }, [user]);

  useEffect(() => {
    if (user) void loadRecords();
  }, [user, loadRecords]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as (HTMLInputElement & { name: keyof DailyMeasure }) | (HTMLTextAreaElement & { name: keyof DailyMeasure });
    setForm((prev) => {
      if (type === "number") {
        const num =
          value === "" ? undefined : clampNum(String(name), Number(value));
        return { ...prev, [name]: num } as DailyMeasure;
      }
      return { ...prev, [name]: value } as DailyMeasure;
    });
  };

  // Quick presets
  const presets = [
    { label: "Normal BP", patch: { systolic: 118, diastolic: 76 } },
    { label: "Fever", patch: { temperatureC: 38.4 } },
    { label: "Morning Fast", patch: { sugarMgDl: 92 } },
  ];

  // Optimistic save with rollback
  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setMsg(null);
    const normalized = normalize(form);
    const id = normalized.date || todayISO();
    const ref = doc(db, "users", user.uid, "dailyMeasures", id);

    // attach metadata
    const addedByRole = (role ?? "patient") as DailyMeasure["addedByRole"];
    const addedByName =
      (userDoc && (userDoc.fullName as string)) ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Unknown";
    const source: DailyMeasure["source"] =
      addedByRole === "caregiver" ? "caregiver" : "patient";

    const payload: DailyMeasure = {
      ...normalized,
      source,
      addedByUid: user.uid,
      addedByRole,
      addedByName,
      createdAt: Timestamp.now(),
    };

    const prev = records;
    // optimistic: ensure single entry per date at top
    setRecords((rs) =>
      [payload, ...rs.filter((r) => r.date !== id)].slice(0, 14)
    );

    try {
      await setDoc(ref, payload, { merge: true });
      setMsg("✅ Saved successfully!");

      // 👉 Run AI evaluation & possibly email alert
      setAiBusy(true);
      try {
        const { advice, risk, notified } = await aiEvaluateDaily(
          payload.date
        );
        setAiAdvice(advice || "");
        setAiRisk(coerceRisk(risk));
        setAiNotified(Boolean(notified));
      } catch (e) {
        console.error("AI eval failed", e);
        setAiAdvice("");
        setAiRisk("Unknown");
        setAiNotified(false);
      } finally {
        setAiBusy(false);
      }
    } catch (err) {
      console.error(err);
      setRecords(prev); // rollback
      setMsg("❌ Failed to save, please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  async function deleteRecord(date: string) {
    if (!user) return;
    // OPTIONAL: lock deletion if not creator (uncomment to enforce)
    // const rec = records.find(r => r.date === date);
    // if (rec && rec.addedByUid && rec.addedByUid !== user.uid) {
    //   alert("You can’t delete a record created by someone else.");
    //   return;
    // }
    if (!confirm(`Delete record for ${date}?`)) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "dailyMeasures", date));
      setRecords((rs) => rs.filter((r) => r.date !== date));
    } catch (e) {
      console.error(e);
      alert("Failed to delete record.");
    }
  }

  // Ascending date for charts
  const chartData = useMemo(() => records.slice().reverse(), [records]);

  const pickNums = useCallback(
    (k: keyof DailyMeasure) =>
      chartData
        .map((d) => (typeof d[k] === "number" ? (d[k] as number) : undefined))
        .filter((v): v is number => v != null),
    [chartData]
  );

  const domains = useMemo(() => {
    return {
      systolic: calcTightDomain(pickNums("systolic"), 5),
      diastolic: calcTightDomain(pickNums("diastolic"), 5),
      sugarMgDl: calcTightDomain(pickNums("sugarMgDl"), 5),
      sugarPostMgDl: calcTightDomain(pickNums("sugarPostMgDl"), 5),
      cholesterolTotal: calcTightDomain(pickNums("cholesterolTotal"), 10),
      weightKg: calcTightDomain(pickNums("weightKg"), 0.5),
      spo2Pct: calcTightDomain(pickNums("spo2Pct"), 1),
      temperatureC: calcTightDomain(pickNums("temperatureC"), 0.2),
      waterIntakeL: calcTightDomain(pickNums("waterIntakeL"), 0.2),
    } as const;
  }, [pickNums]);

  const latest = records[0] ? normalize(records[0]) : undefined;
  const latestBMI = calcBMI(latest?.weightKg, latest?.heightCm);

  function hasSeries(key: keyof DailyMeasure) {
    return chartData.some((d) => typeof d[key] === "number");
  }

  function exportCsv(ds: DailyMeasure[]) {
    const cols: (keyof DailyMeasure)[] = [
      "date",
      "systolic",
      "diastolic",
      "sugarMgDl",
      "sugarPostMgDl",
      "cholesterolTotal",
      "spo2Pct",
      "temperatureC",
      "weightKg",
      "heightCm",
      "exerciseMins",
      "waterIntakeL",
      "source",
      "addedByRole",
      "addedByName",
      "note",
    ];
    const rows = [cols.join(",")]
      .concat(ds.map((d) => cols.map((k) => (d[k] ?? "") as any).join(",")))
      .join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daily-measures.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const HeadChip = ({
    label,
    status,
    unit,
    value,
  }: {
    label: string;
    status?: Status;
    unit?: string;
    value?: string | number;
  }) => (
    <div className="flex items-center gap-2">
      <span className="text-white/80">{label}</span>
      {badge(status)}
      {value != null && (
        <span className="text-xs text-white/60">
          {value}
          {unit ? ` ${unit}` : ""}
        </span>
      )}
    </div>
  );

  // previous value helpers (for deltas)
  const prev = records[1] ? normalize(records[1]) : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white py-10 px-5">
      <div className="max-w-6xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                🩺 Daily Health Measurements
              </h1>
              <p className="text-white/70 mt-1">
                Enter your daily vitals and see compact trends with clear{" "}
                <span className="text-white">Good/OK/Bad</span> status.
              </p>
            </div>
            <button
              onClick={() => exportCsv(records.slice(0, 90))}
              className="text-sm rounded bg-black/40 px-3 py-2 border border-white/10 hover:bg-black/50"
            >
              Export CSV
            </button>
          </div>
        </motion.div>

        {/* Status headline (latest) */}
        {latest && (
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4 grid gap-3 md:grid-cols-3">
            <HeadChip
              label="Blood Pressure"
              status={statusBP(latest.systolic, latest.diastolic)}
              unit="mmHg"
              value={
                latest.systolic != null && latest.diastolic != null
                  ? `${latest.systolic}/${latest.diastolic}`
                  : undefined
              }
            />
            <HeadChip
              label="Fasting Sugar"
              status={statusSugarFasting(latest.sugarMgDl)}
              unit="mg/dL"
              value={latest.sugarMgDl}
            />
            <HeadChip
              label="2h Post Sugar"
              status={statusSugarPost(latest.sugarPostMgDl)}
              unit="mg/dL"
              value={latest.sugarPostMgDl}
            />
            <HeadChip
              label="Cholesterol"
              status={statusCholTotal(latest.cholesterolTotal)}
              unit="mg/dL"
              value={latest.cholesterolTotal}
            />
            <HeadChip
              label="SpO₂"
              status={statusSpO2(latest.spo2Pct)}
              unit="%"
              value={latest.spo2Pct}
            />
            <HeadChip
              label="Temperature"
              status={statusTemp(latest.temperatureC)}
              unit="°C"
              value={latest.temperatureC}
            />
            <HeadChip
              label="Weight"
              status={statusBMI(latestBMI)}
              unit="kg"
              value={[
                latest.weightKg ?? undefined,
                delta(latest.weightKg, prev?.weightKg)
                  ? `(${delta(latest.weightKg, prev?.weightKg)})`
                  : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
            />
            <HeadChip
              label="BMI"
              status={statusBMI(latestBMI)}
              unit="kg/m²"
              value={latestBMI}
            />
            <HeadChip
              label="Water Intake"
              status={statusWater(latest.waterIntakeL, latest.weightKg)}
              unit="L/day"
              value={
                latest.waterIntakeL != null ? latest.waterIntakeL : undefined
              }
            />
          </div>
        )}

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {inputFields.map((f) => {
              const raw = (form as Record<string, unknown>)[f.name];
              const valueProp =
                typeof raw === "number"
                  ? raw
                  : (raw as string | undefined) ?? "";
              return (
                <input
                  key={f.name as string}
                  name={f.name as string}
                  type={f.type}
                  step={f.step}
                  placeholder={f.label}
                  value={valueProp}
                  onChange={handleChange}
                  className="rounded-xl border border-white/10 bg-black/40 p-2 focus:ring-2 focus:ring-green-400/50"
                />
              );
            })}
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="rounded-xl border border-white/10 bg-black/40 p-2 focus:ring-2 focus:ring-green-400/50"
            />
          </div>

          {/* Optional note (useful for caregivers) */}
          <div className="mt-3">
            <textarea
              name="note"
              placeholder={role === "caregiver" ? "Add a note (e.g., measured at 8:30 AM at home)" : "Note (optional)"}
              value={form.note ?? ""}
              onChange={handleChange}
              className="w-full rounded-xl border border-white/10 bg-black/40 p-2 focus:ring-2 focus:ring-green-400/50"
              rows={2}
            />
            {role === "caregiver" && (
              <div className="mt-1 text-xs text-white/60">
                This entry will be labeled as <b>Caregiver</b> in the patient’s list.
              </div>
            )}
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-2 mt-3">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, ...p.patch }))}
                className="text-xs rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-semibold"
            >
              {loading ? "Saving..." : "Save Measurement"}
            </button>
            {msg && (
              <span
                className={`text-sm ${
                  msg.startsWith("✅") ? "text-green-400" : "text-red-400"
                }`}
              >
                {msg}
              </span>
            )}
          </div>

          {/* AI Advice */}
          {(aiBusy || aiAdvice) && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">🤖 HealthCoach Advice</h4>
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${
                    aiRisk === "Emergency"
                      ? "bg-red-700/30 text-red-200 border-red-500/50"
                      : aiRisk === "Bad"
                      ? "bg-red-500/20 text-red-300 border-red-400/30"
                      : aiRisk === "OK"
                      ? "bg-yellow-500/20 text-yellow-300 border-yellow-400/30"
                      : aiRisk === "Good"
                      ? "bg-green-500/20 text-green-300 border-green-400/30"
                      : "bg-white/10 text-white/70 border-white/20"
                  }`}
                >
                  {aiRisk}
                </span>
              </div>
              {aiBusy ? (
                <p className="text-white/70 text-sm">
                  Analyzing today’s readings…
                </p>
              ) : aiAdvice ? (
                <pre className="whitespace-pre-wrap text-sm text-white/90">
                  {aiAdvice}
                </pre>
              ) : (
                <p className="text-white/60 text-sm">No advice yet.</p>
              )}
              {aiNotified && (
                <p className="mt-2 text-xs text-red-300">
                  An alert email was sent to your emergency contact for today’s
                  readings.
                </p>
              )}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={async () => {
                    setAiBusy(true);
                    try {
                      const { advice, risk, notified } = await aiEvaluateDaily(
                        form.date
                      );
                      setAiAdvice(advice || "");
                      setAiRisk(coerceRisk(risk));
                      setAiNotified(Boolean(notified));
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setAiBusy(false);
                    }
                  }}
                  className="text-xs rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                  disabled={aiBusy}
                >
                  {aiBusy ? "Analyzing…" : "Get AI Advice"}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">📊 Compact Trends</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Blood Pressure */}
              {hasSeries("systolic") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">
                      Blood Pressure
                    </h3>
                    {badge(statusBP(latest?.systolic, latest?.diastolic))}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3b3b3b"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#aaa"
                        tick={{ fontSize: 11 }}
                        tickMargin={6}
                      />
                      <YAxis
                        domain={domains.systolic}
                        stroke="#aaa"
                        width={36}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222",
                          border: "1px solid #555",
                          color: "white",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="systolic"
                        stroke="#60A5FA"
                        dot={false}
                        strokeWidth={2}
                        name="Systolic"
                      />
                      <Line
                        type="monotone"
                        dataKey="diastolic"
                        stroke="#93C5FD"
                        dot={false}
                        strokeWidth={2}
                        name="Diastolic"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Fasting Sugar */}
              {hasSeries("sugarMgDl") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">Fasting Sugar</h3>
                    {badge(statusSugarFasting(latest?.sugarMgDl))}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3b3b3b"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#aaa"
                        tick={{ fontSize: 11 }}
                        tickMargin={6}
                      />
                      <YAxis
                        domain={domains.sugarMgDl}
                        stroke="#aaa"
                        width={36}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222",
                          border: "1px solid #555",
                          color: "white",
                        }}
                      />
                      <ReferenceArea
                        y1={70}
                        y2={99}
                        strokeOpacity={0}
                        fill="#10B98133"
                      />
                      <Line
                        type="monotone"
                        dataKey="sugarMgDl"
                        stroke="#FB7185"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* 2h Post Sugar */}
              {hasSeries("sugarPostMgDl") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">
                      2h Post Meal Sugar
                    </h3>
                    {badge(statusSugarPost(latest?.sugarPostMgDl))}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3b3b3b"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#aaa"
                        tick={{ fontSize: 11 }}
                        tickMargin={6}
                      />
                      <YAxis
                        domain={domains.sugarPostMgDl}
                        stroke="#aaa"
                        width={36}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222",
                          border: "1px solid #555",
                          color: "white",
                        }}
                      />
                      <ReferenceArea
                        y1={0}
                        y2={139}
                        strokeOpacity={0}
                        fill="#10B98133"
                      />
                      <Line
                        type="monotone"
                        dataKey="sugarPostMgDl"
                        stroke="#F472B6"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Cholesterol (Total) */}
              {hasSeries("cholesterolTotal") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">
                      Total Cholesterol
                    </h3>
                    {badge(statusCholTotal(latest?.cholesterolTotal))}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3b3b3b"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#aaa"
                        tick={{ fontSize: 11 }}
                        tickMargin={6}
                      />
                      <YAxis
                        domain={domains.cholesterolTotal}
                        stroke="#aaa"
                        width={44}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222",
                          border: "1px solid #555",
                          color: "white",
                        }}
                      />
                      <ReferenceArea
                        y1={0}
                        y2={199}
                        strokeOpacity={0}
                        fill="#10B98133"
                      />
                      <Line
                        type="monotone"
                        dataKey="cholesterolTotal"
                        stroke="#38BDF8"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* SpO2 */}
              {hasSeries("spo2Pct") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">SpO₂</h3>
                    {badge(statusSpO2(latest?.spo2Pct))}
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3b3b3b"
                        vertical={false}
                      />
                      <XAxis dataKey="date" stroke="#aaa" hide />
                      <YAxis
                        domain={domains.spo2Pct}
                        stroke="#aaa"
                        width={44}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222",
                          border: "1px solid #555",
                          color: "white",
                        }}
                      />
                      <ReferenceArea
                        y1={95}
                        y2={100}
                        strokeOpacity={0}
                        fill="#10B98133"
                      />
                      <Line
                        type="monotone"
                        dataKey="spo2Pct"
                        stroke="#FBBF24"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Temperature */}
              {hasSeries("temperatureC") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">Temperature</h3>
                    {badge(statusTemp(latest?.temperatureC))}
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3b3b3b"
                        vertical={false}
                      />
                      <XAxis dataKey="date" stroke="#aaa" hide />
                      <YAxis
                        domain={domains.temperatureC}
                        stroke="#aaa"
                        width={44}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222",
                          border: "1px solid #555",
                          color: "white",
                        }}
                      />
                      <ReferenceArea
                        y1={36.1}
                        y2={37.2}
                        strokeOpacity={0}
                        fill="#10B98133"
                      />
                      <Line
                        type="monotone"
                        dataKey="temperatureC"
                        stroke="#A78BFA"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Weight & BMI */}
              {hasSeries("weightKg") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">Weight</h3>
                    {badge(statusBMI(latestBMI))}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3b3b3b"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#aaa"
                        tick={{ fontSize: 11 }}
                        tickMargin={6}
                      />
                      <YAxis
                        domain={domains.weightKg}
                        stroke="#aaa"
                        width={44}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222",
                          border: "1px solid #555",
                          color: "white",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weightKg"
                        stroke="#34D399"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {latestBMI != null && (
                    <div className="text-xs text-white/70 mt-1">
                      BMI: <b>{latestBMI}</b> ({statusBMI(latestBMI)})
                    </div>
                  )}
                </motion.div>
              )}

              {/* Water Intake */}
              {hasSeries("waterIntakeL") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">
                      Daily Water Intake
                    </h3>
                    {badge(statusWater(latest?.waterIntakeL, latest?.weightKg))}
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3b3b3b"
                        vertical={false}
                      />
                      <XAxis dataKey="date" stroke="#aaa" hide />
                      <YAxis
                        domain={domains.waterIntakeL}
                        stroke="#aaa"
                        width={44}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#222",
                          border: "1px solid #555",
                          color: "white",
                        }}
                      />
                      {latest?.weightKg && (
                        <ReferenceArea
                          y1={Number((0.03 * latest.weightKg).toFixed(2))}
                          y2={Number((0.035 * latest.weightKg).toFixed(2))}
                          strokeOpacity={0}
                          fill="#10B98133"
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="waterIntakeL"
                        stroke="#22D3EE"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {latest?.weightKg && (
                    <div className="text-xs text-white/70 mt-1">
                      Target: {Number((0.03 * latest.weightKg).toFixed(2))}–
                      {Number((0.035 * latest.weightKg).toFixed(2))} L/day
                      (based on {latest.weightKg} kg)
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Recent Records */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-xl font-semibold mb-3">🗓 Recent Records</h2>
          <div className="grid gap-3">
            {records.map((r) => {
              const rec = normalize(r);
              const bmi = calcBMI(rec.weightKg, rec.heightCm);
              const sourceChip =
                rec.source === "caregiver"
                  ? "bg-blue-500/20 text-blue-200 border-blue-400/30"
                  : "bg-white/10 text-white/70 border-white/20";
              return (
                <div
                  key={r.date}
                  className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-3 text-sm hover:bg-white/5 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <b>{r.date}</b>
                      <span className={`text-2xs px-2 py-0.5 rounded border ${sourceChip}`}>
                        {rec.source === "caregiver" ? `Caregiver${rec.addedByName ? ` • ${rec.addedByName}` : ""}` : "Patient"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setForm(rec)}
                        className="text-xs rounded bg-blue-600/80 px-2 py-0.5 hover:bg-blue-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteRecord(r.date)}
                        className="text-xs rounded bg-red-600/80 px-2 py-0.5 hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {rec.note && (
                    <div className="mt-1 text-white/70">
                      <span className="text-white/60">Note:</span> {rec.note}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {badge(statusBP(rec.systolic, rec.diastolic))}
                    {badge(statusSugarFasting(rec.sugarMgDl))}
                    {badge(statusSugarPost(rec.sugarPostMgDl))}
                    {badge(statusCholTotal(rec.cholesterolTotal))}
                    {badge(statusSpO2(rec.spo2Pct))}
                    {badge(statusTemp(rec.temperatureC))}
                    {badge(statusBMI(bmi))}
                    {badge(statusWater(rec.waterIntakeL, rec.weightKg))}
                  </div>

                  <div className="text-white/80 mt-1">
                    BP: {rec.systolic ?? "-"} / {rec.diastolic ?? "-"} mmHg ·
                    Fasting Sugar: {rec.sugarMgDl ?? "-"} mg/dL · Post:{" "}
                    {rec.sugarPostMgDl ?? "-"} mg/dL · Chol:{" "}
                    {rec.cholesterolTotal ?? "-"} mg/dL · SpO₂:{" "}
                    {rec.spo2Pct ?? "-"}% · Temp: {rec.temperatureC ?? "-"}°C ·
                    Weight: {rec.weightKg ?? "-"} kg
                    {rec.heightCm ? ` · Height: ${rec.heightCm} cm` : ""} ·
                    Water: {rec.waterIntakeL ?? "-"} L
                    {bmi != null ? ` · BMI: ${bmi}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
