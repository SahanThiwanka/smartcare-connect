"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getCaregiverPatients,
  getUser,
  type UserLite,
} from "@/lib/caregivers";
import {
  getDailyMeasures,
  upsertDailyMeasureForPatient,
  type DailyMeasure,
} from "@/lib/dailyMeasures";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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

/* ===== helpers ===== */

function todayISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n =
    typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function normalize(rec: DailyMeasure): DailyMeasure {
  return {
    ...rec,
    systolic: toNum(rec.systolic),
    diastolic: toNum(rec.diastolic),
    sugarMgDl: toNum(rec.sugarMgDl),
    sugarPostMgDl: toNum(rec.sugarPostMgDl),
    cholesterolTotal: toNum(rec.cholesterolTotal),
    spo2Pct: toNum(rec.spo2Pct),
    temperatureC: toNum(rec.temperatureC),
    weightKg: toNum(rec.weightKg),
    heightCm: toNum(rec.heightCm),
    exerciseMins: toNum(rec.exerciseMins),
    waterIntakeL: toNum(rec.waterIntakeL),
  };
}

type Status = "Good" | "OK" | "Bad" | "Emergency";
function calcTightDomain(values: number[], minRange = 1): [number, number] {
  const nums = values.filter((v) => Number.isFinite(v)) as number[];
  if (!nums.length) return [0, 1];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = Math.max(max - min, minRange);
  const pad = span * 0.1;
  return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
}
function statusBP(s?: number, d?: number): Status | undefined {
  if (s == null || d == null) return undefined;
  if (s > 180 || d > 120) return "Emergency";
  if (s < 120 && d < 80) return "Good";
  if (s >= 120 && s <= 129 && d < 80) return "OK";
  return "Bad";
}
function statusSugarFasting(mgdl?: number): Status | undefined {
  if (mgdl == null) return undefined;
  if (mgdl >= 70 && mgdl <= 99) return "Good";
  if (mgdl >= 100 && mgdl <= 125) return "OK";
  if (mgdl >= 126) return "Bad";
}
function statusSugarPost(mgdl?: number): Status | undefined {
  if (mgdl == null) return undefined;
  if (mgdl <= 139) return "Good";
  if (mgdl >= 140 && mgdl <= 199) return "OK";
  if (mgdl >= 200) return "Bad";
}
function statusCholTotal(mgdl?: number): Status | undefined {
  if (mgdl == null) return undefined;
  if (mgdl <= 199) return "Good";
  if (mgdl >= 200 && mgdl <= 239) return "OK";
  if (mgdl >= 240) return "Bad";
}
function statusSpO2(pct?: number): Status | undefined {
  if (pct == null) return undefined;
  if (pct >= 95) return "Good";
  if (pct >= 90) return "OK";
  return "Bad";
}
function statusTemp(c?: number): Status | undefined {
  if (c == null) return undefined;
  if (c >= 36.1 && c <= 37.2) return "Good";
  if ((c >= 37.3 && c <= 38.0) || c < 36.0) return "OK";
  if (c >= 38.1) return "Bad";
}
function calcBMI(weightKg?: number, heightCm?: number): number | undefined {
  if (!weightKg || !heightCm) return undefined;
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  return Number.isFinite(bmi) ? Number(Math.round(bmi * 10) / 10) : undefined;
}
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

/* ===== Page ===== */

export default function CaregiverDashboardPage() {
  const { user } = useAuth();

  const [me, setMe] = useState<UserLite | null>(null);
  const [patients, setPatients] = useState<UserLite[]>([]);
  const [selected, setSelected] = useState<string>("");

  const [measures, setMeasures] = useState<DailyMeasure[]>([]);
  const [loadingMeasures, setLoadingMeasures] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const [form, setForm] = useState<Partial<DailyMeasure>>({
    date: todayISO(),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /** hydrate via your existing helper if the direct path has nothing / is blocked by rules */
  const loadMeasures = useCallback(async (pid: string) => {
    setLoadingMeasures(true);
    try {
      const rows = await getDailyMeasures(pid, 30);
      setMeasures(rows);
    } finally {
      setLoadingMeasures(false);
    }
  }, []);

  const hydrateViaHelper = useCallback(async () => {
    if (!user) return;
    try {
      const pts = await getCaregiverPatients(user.uid);
      console.log("[fallback helper] patients:", pts);
      pts.sort((a, b) => {
        const an = (a.fullName || "").toLowerCase();
        const bn = (b.fullName || "").toLowerCase();
        if (an && bn && an !== bn) return an.localeCompare(bn);
        return (a.email || "")
          .toLowerCase()
          .localeCompare((b.email || "").toLowerCase());
      });
      setPatients(pts);
      if (pts.length) {
        const first = pts[0].uid;
        setSelected((s) => s || first);
        await loadMeasures(first);
      } else {
        setSelected("");
        setMeasures([]);
      }
    } catch (err) {
      console.error("[helper] getCaregiverPatients failed", err);
      setPatients([]);
      setSelected("");
      setMeasures([]);
    } finally {
      setLoadingPatients(false);
    }
  }, [user, loadMeasures]);

  /** initial mount: set me + subscribe to caregivers/{me}/patients realtime */
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setLoadingPatients(true);

    // who am I
    getUser(user.uid)
      .then((u) => !cancelled && setMe(u ?? null))
      .catch(() => !cancelled && setMe(null));

    // realtime list
    const colRef = collection(db, "caregivers", user.uid, "patients");
    const unsub = onSnapshot(
      colRef,
      async (snap) => {
        if (cancelled) return;

        console.log("[cg patients] snapshot size:", snap.size);
        // accept shape: {status:"approved"} or {approved:true} (or even empty doc = approved)
        const ids = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter(
            (r) =>
              (r.status ?? "approved") === "approved" || r.approved === true
          )
          .map((r) => r.id);

        if (ids.length === 0) {
          console.log(
            "[cg patients] none found in caregivers/{cg}/patients -> fallback to helper"
          );
          await hydrateViaHelper();
          return;
        }

        const hydrated: UserLite[] = (
          await Promise.all(
            ids.map(async (pid) => {
              try {
                const s = await getDoc(doc(db, "users", pid));
                if (!s.exists()) return null;
                const d = s.data() as any;
                return {
                  uid: pid,
                  fullName: d.fullName || "",
                  email: d.email || "",
                } as UserLite;
              } catch (e) {
                console.warn("[hydrate user] failed for", pid, e);
                return null;
              }
            })
          )
        ).filter(Boolean) as UserLite[];

        hydrated.sort((a, b) => {
          const an = (a.fullName || "").toLowerCase();
          const bn = (b.fullName || "").toLowerCase();
          if (an && bn && an !== bn) return an.localeCompare(bn);
          return (a.email || "")
            .toLowerCase()
            .localeCompare((b.email || "").toLowerCase());
        });

        setPatients(hydrated);

        if (!hydrated.length) {
          setSelected("");
          setMeasures([]);
        } else if (!hydrated.find((p) => p.uid === selected)) {
          const next = hydrated[0].uid;
          setSelected(next);
          await loadMeasures(next);
        }

        setLoadingPatients(false);
      },
      async (err) => {
        console.error("[cg patients] onSnapshot error:", err);
        await hydrateViaHelper();
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hydrateViaHelper, loadMeasures]);

  /* ===== charts data & domains ===== */
  const chartData = useMemo(
    () => measures.slice().reverse().map(normalize),
    [measures]
  );

  const pick = useCallback(
    (k: keyof DailyMeasure) =>
      chartData
        .map((d) => (typeof d[k] === "number" ? (d[k] as number) : undefined))
        .filter((v): v is number => v != null),
    [chartData]
  );

  const domains = useMemo(() => {
    return {
      systolic: calcTightDomain(pick("systolic"), 5),
      diastolic: calcTightDomain(pick("diastolic"), 5),
      sugarMgDl: calcTightDomain(pick("sugarMgDl"), 5),
      sugarPostMgDl: calcTightDomain(pick("sugarPostMgDl"), 5),
      cholesterolTotal: calcTightDomain(pick("cholesterolTotal"), 10),
      spo2Pct: calcTightDomain(pick("spo2Pct"), 1),
      temperatureC: calcTightDomain(pick("temperatureC"), 0.2),
      weightKg: calcTightDomain(pick("weightKg"), 0.5),
      waterIntakeL: calcTightDomain(pick("waterIntakeL"), 0.2),
    } as const;
  }, [pick]);

  /* ===== actions ===== */

  function setF<K extends keyof DailyMeasure>(k: K, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function n(x: any) {
    return x === "" || x == null ? undefined : Number(x);
  }

  async function save() {
    if (!user || !selected || !form.date) {
      setMsg("Please select a patient and a date.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await upsertDailyMeasureForPatient(selected, {
        date: form.date,
        systolic: n(form.systolic),
        diastolic: n(form.diastolic),
        sugarMgDl: n(form.sugarMgDl),
        sugarPostMgDl: n(form.sugarPostMgDl),
        cholesterolTotal: n(form.cholesterolTotal),
        spo2Pct: n(form.spo2Pct),
        temperatureC: n(form.temperatureC),
        weightKg: n(form.weightKg),
        heightCm: n(form.heightCm),
        exerciseMins: n(form.exerciseMins),
        waterIntakeL: n(form.waterIntakeL),
        addedBy: "caregiver",
        caregiverId: user.uid,
        caregiverName: me?.fullName || me?.email || "Caregiver",
      } as DailyMeasure);

      await loadMeasures(selected);
      setMsg("✅ Saved.");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "❌ Failed to save");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 3000);
    }
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
      "addedBy" as any,
      "caregiverName" as any,
    ];
    const rows = [cols.join(",")]
      .concat(ds.map((d) => cols.map((k) => (d as any)[k] ?? "").join(",")))
      .join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "patient-daily-measures.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ===== UI ===== */

  const latest = measures[0] ? normalize(measures[0]) : undefined;
  const latestBMI = calcBMI(latest?.weightKg, latest?.heightCm);

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

  const hasSeries = (key: keyof DailyMeasure) =>
    chartData.some((d) => typeof d[key] === "number");

  const presets = [
    { label: "Normal BP", patch: { systolic: 118, diastolic: 76 } },
    { label: "Fever", patch: { temperatureC: 38.4 } },
    { label: "Morning Fast", patch: { sugarMgDl: 92 } },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Caregiver Dashboard</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => selected && exportCsv(measures)}
              className="text-sm rounded bg-black/40 px-3 py-2 border border-white/10 hover:bg-black/50 disabled:opacity-50"
              disabled={!selected || measures.length === 0}
            >
              Export CSV
            </button>
            <button
              onClick={() => selected && loadMeasures(selected)}
              className="text-sm rounded bg-black/40 px-3 py-2 border border-white/10 hover:bg-black/50 disabled:opacity-50"
              disabled={!selected}
            >
              Reload
            </button>
          </div>
        </div>

        {/* Patient picker */}
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <label className="text-sm block mb-2">Select patient</label>
          {loadingPatients ? (
            <div className="text-white/70 text-sm">Loading patients…</div>
          ) : patients.length === 0 ? (
            <div className="text-white/70 text-sm">
              No approved patients yet. Ask a patient to send a caregiver request and approve it.
            </div>
          ) : (
            <select
              value={selected}
              onChange={async (e) => {
                const id = e.target.value;
                setSelected(id);
                await loadMeasures(id);
              }}
              className="rounded bg-black/40 border border-white/10 px-3 py-2"
            >
              {patients.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.fullName || p.email || p.uid}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Latest status headline */}
        {loadingMeasures ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-white/70 text-sm">Loading measurements…</div>
          </div>
        ) : latest ? (
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
              status={
                (() => {
                  const bmi = calcBMI(latest?.weightKg, latest?.heightCm);
                  if (bmi == null) return undefined;
                  if (bmi >= 18.5 && bmi <= 24.9) return "Good";
                  if (bmi >= 30) return "Bad";
                  return "OK";
                })()
              }
              unit="kg"
              value={latest.weightKg}
            />
            <HeadChip label="BMI" value={calcBMI(latest?.weightKg, latest?.heightCm)} unit="kg/m²" />
            <HeadChip label="Water Intake" unit="L/day" value={latest.waterIntakeL} />
          </div>
        ) : null}

        {/* Add measure */}
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Add Daily Measure</h2>
            <div className="flex gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, ...p.patch }))}
                  className="text-xs rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const last = measures[0];
                  if (!last) return;
                  const { date, ...rest } = last as DailyMeasure;
                  setForm((f) => ({ ...rest, date: f.date || todayISO() }));
                }}
                className="text-xs rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
              >
                Same as yesterday
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {(
              [
                ["date", "date"],
                ["systolic", "number"],
                ["diastolic", "number"],
                ["sugarMgDl", "number"],
                ["sugarPostMgDl", "number"],
                ["cholesterolTotal", "number"],
                ["spo2Pct", "number"],
                ["temperatureC", "number"],
                ["weightKg", "number"],
                ["heightCm", "number"],
                ["exerciseMins", "number"],
                ["waterIntakeL", "number"],
              ] as const
            ).map(([name, type]) => (
              <input
                key={name}
                name={name}
                type={type}
                placeholder={name}
                step={type === "number" ? "any" : undefined}
                value={(form as any)[name] ?? ""}
                onChange={(e) => setF(name as keyof DailyMeasure, e.target.value)}
                className="rounded border border-white/10 bg-black/40 px-3 py-2"
              />
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void save()}
              disabled={busy || !selected}
              className="rounded bg-green-600 px-4 py-2 font-semibold hover:bg-green-500 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {msg && <span className="text-sm text-white/80">{msg}</span>}
          </div>
        </div>

        {/* Compact trends */}
        {chartData.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">📊 Compact Trends</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Blood Pressure */}
              {hasSeries("systolic") && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">Blood Pressure</h3>
                    {badge(statusBP(chartData.at(-1)?.systolic, chartData.at(-1)?.diastolic))}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3b3b3b" vertical={false} />
                      <XAxis dataKey="date" stroke="#aaa" tick={{ fontSize: 11 }} tickMargin={6} />
                      <YAxis domain={domains.systolic} stroke="#aaa" width={36} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#222", border: "1px solid #555", color: "white" }} />
                      <Line type="monotone" dataKey="systolic" stroke="#60A5FA" dot={false} strokeWidth={2} name="Systolic" />
                      <Line type="monotone" dataKey="diastolic" stroke="#93C5FD" dot={false} strokeWidth={2} name="Diastolic" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Fasting Sugar */}
              {hasSeries("sugarMgDl") && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">Fasting Sugar</h3>
                    {badge(statusSugarFasting(chartData.at(-1)?.sugarMgDl))}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3b3b3b" vertical={false} />
                      <XAxis dataKey="date" stroke="#aaa" tick={{ fontSize: 11 }} tickMargin={6} />
                      <YAxis domain={domains.sugarMgDl} stroke="#aaa" width={36} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#222", border: "1px solid #555", color: "white" }} />
                      <ReferenceArea y1={70} y2={99} strokeOpacity={0} fill="#10B98133" />
                      <Line type="monotone" dataKey="sugarMgDl" stroke="#FB7185" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 2h Post Sugar */}
              {hasSeries("sugarPostMgDl") && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">2h Post Meal Sugar</h3>
                    {badge(statusSugarPost(chartData.at(-1)?.sugarPostMgDl))}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3b3b3b" vertical={false} />
                      <XAxis dataKey="date" stroke="#aaa" tick={{ fontSize: 11 }} tickMargin={6} />
                      <YAxis domain={domains.sugarPostMgDl} stroke="#aaa" width={36} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#222", border: "1px solid #555", color: "white" }} />
                      <ReferenceArea y1={0} y2={139} strokeOpacity={0} fill="#10B98133" />
                      <Line type="monotone" dataKey="sugarPostMgDl" stroke="#F472B6" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Cholesterol */}
              {hasSeries("cholesterolTotal") && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">Total Cholesterol</h3>
                    {badge(statusCholTotal(chartData.at(-1)?.cholesterolTotal))}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3b3b3b" vertical={false} />
                      <XAxis dataKey="date" stroke="#aaa" tick={{ fontSize: 11 }} tickMargin={6} />
                      <YAxis domain={domains.cholesterolTotal} stroke="#aaa" width={44} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#222", border: "1px solid #555", color: "white" }} />
                      <ReferenceArea y1={0} y2={199} strokeOpacity={0} fill="#10B98133" />
                      <Line type="monotone" dataKey="cholesterolTotal" stroke="#38BDF8" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* SpO2 */}
              {hasSeries("spo2Pct") && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">SpO₂</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3b3b3b" vertical={false} />
                      <XAxis dataKey="date" stroke="#aaa" hide />
                      <YAxis domain={domains.spo2Pct} stroke="#aaa" width={44} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#222", border: "1px solid #555", color: "white" }} />
                      <ReferenceArea y1={95} y2={100} strokeOpacity={0} fill="#10B98133" />
                      <Line type="monotone" dataKey="spo2Pct" stroke="#FBBF24" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Temperature */}
              {hasSeries("temperatureC") && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">Temperature</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3b3b3b" vertical={false} />
                      <XAxis dataKey="date" stroke="#aaa" hide />
                      <YAxis domain={domains.temperatureC} stroke="#aaa" width={44} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#222", border: "1px solid #555", color: "white" }} />
                      <ReferenceArea y1={36.1} y2={37.2} strokeOpacity={0} fill="#10B98133" />
                      <Line type="monotone" dataKey="temperatureC" stroke="#A78BFA" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Weight */}
              {hasSeries("weightKg") && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">Weight</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3b3b3b" vertical={false} />
                      <XAxis dataKey="date" stroke="#aaa" tick={{ fontSize: 11 }} tickMargin={6} />
                      <YAxis domain={domains.weightKg} stroke="#aaa" width={44} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#222", border: "1px solid #555", color: "white" }} />
                      <Line type="monotone" dataKey="weightKg" stroke="#34D399" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                  {latestBMI != null && (
                    <div className="text-xs text-white/70 mt-1">
                      BMI: <b>{latestBMI}</b>
                    </div>
                  )}
                </div>
              )}

              {/* Water */}
              {hasSeries("waterIntakeL") && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/90">Daily Water Intake</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3b3b3b" vertical={false} />
                      <XAxis dataKey="date" stroke="#aaa" hide />
                      <YAxis domain={domains.waterIntakeL} stroke="#aaa" width={44} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#222", border: "1px solid #555", color: "white" }} />
                      <Line type="monotone" dataKey="waterIntakeL" stroke="#22D3EE" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent list w/ provenance */}
        {measures.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <h2 className="font-semibold mb-3">🗓 Recent Records</h2>
            <div className="grid gap-2 text-sm">
              {measures.map((r) => {
                const m = normalize(r);
                const by =
                  (m as any).addedBy === "caregiver"
                    ? `Caregiver${(m as any).caregiverName ? `: ${(m as any).caregiverName}` : ""}`
                    : "Patient";
                return (
                  <div
                    key={`${m.date}-${(m as any).addedBy ?? "patient"}`}
                    className="rounded border border-white/10 bg-black/30 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <b>{m.date}</b>
                      <span className="text-xs text-white/60">{by}</span>
                    </div>
                    <div className="text-white/80 mt-1">
                      BP: {m.systolic ?? "-"} / {m.diastolic ?? "-"} mmHg ·
                      Fasting Sugar: {m.sugarMgDl ?? "-"} mg/dL · Post:{" "}
                      {m.sugarPostMgDl ?? "-"} mg/dL · Chol:{" "}
                      {m.cholesterolTotal ?? "-"} mg/dL · SpO₂:{" "}
                      {m.spo2Pct ?? "-"}% · Temp: {m.temperatureC ?? "-"}°C ·
                      Weight: {m.weightKg ?? "-"} kg
                      {m.heightCm ? ` · Height: ${m.heightCm} cm` : ""} · Water:{" "}
                      {m.waterIntakeL ?? "-"} L
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
