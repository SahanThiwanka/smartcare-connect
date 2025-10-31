"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByDoctor, Appointment } from "@/lib/appointments";
import { getPatientInfo } from "@/lib/patients";
import { getPatientRecords, RecordFile } from "@/lib/records";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  FileDown,
  Activity,
  User,
  ClipboardList,
  FileText,
  ChevronDown,
} from "lucide-react";

/* --------------------------------- Types --------------------------------- */

type DailyMeasure = {
  date: string; // YYYY-MM-DD

  // legacy (string) fields
  pressure?: string; // "120/80"
  cholesterol?: string;
  sugar?: string; // fasting
  sugarPost?: string; // post-prandial
  spo2?: string;
  exerciseTime?: string;
  temperature?: string;
  weight?: string;
  height?: string;
  waterIntake?: string;

  // numeric (preferred)
  systolic?: number;
  diastolic?: number;
  sugarMgDl?: number;
  sugarPostMgDl?: number;
  cholesterolTotal?: number;
  spo2Pct?: number;
  exerciseMins?: number;
  temperatureC?: number;
  weightKg?: number;
  heightCm?: number;
  waterIntakeL?: number;
};

type Patient = {
  uid: string;
  fullName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  bloodGroup?: string;
  allergies?: string;
  medications?: string;
};

type Attachment = {
  fileName: string;
  fileUrl: string;
};

type PatientWithHistory = {
  patient: Patient;
  appointments: Appointment[];
  records: RecordFile[];
};

/* ------------------------------ Helper utils ----------------------------- */

function safeDateTime(v?: string | number | Date): string {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "-";
  }
}

/* ---------- Daily Measure helpers (mirrors the patient page rules) -------- */

type Status = "Good" | "OK" | "Bad" | "Emergency";

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
  return "Bad";
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
function statusWater(actualL?: number, weightKg?: number): Status | undefined {
  if (actualL == null || !weightKg) return undefined;
  const min = Number((0.03 * weightKg).toFixed(2));
  const max = Number((0.035 * weightKg).toFixed(2));
  if (actualL >= min && actualL <= max) return "Good";
  const slack = 0.25;
  if (
    (actualL >= min - slack && actualL < min) ||
    (actualL > max && actualL <= max + slack)
  )
    return "OK";
  return "Bad";
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
    <span className={`text-[11px] px-2 py-0.5 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}

/* -------------------------------- Component ------------------------------ */

export default function DoctorPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientWithHistory[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [dailyMeasures, setDailyMeasures] = useState<
    Record<string, DailyMeasure[]>
  >({});

  /* ----------------------------- Initial fetch ---------------------------- */
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const apps = await getAppointmentsByDoctor(user.uid);
        const uniquePatientIds = [...new Set(apps.map((a) => a.patientId))];

        const rows: PatientWithHistory[] = [];
        for (const pid of uniquePatientIds) {
          try {
            const patient = await getPatientInfo(pid);
            const patientApps = apps.filter((a) => a.patientId === pid);
            const records = await getPatientRecords(pid);
            if (patient) {
              rows.push({
                patient: {
                  uid: pid,
                  fullName: patient.fullName ?? "",
                  email: patient.email ?? "",
                  phone: patient.phone ?? "",
                  dob: patient.dob ?? "",
                  bloodGroup: patient.bloodGroup ?? "",
                  allergies: patient.allergies ?? "",
                  medications: patient.medications ?? "",
                },
                appointments: patientApps,
                records,
              });
            }
          } catch (err) {
            console.error("Failed to load a patient row:", err);
          }
        }

        rows.sort((a, b) =>
          (a.patient.fullName || "").localeCompare(b.patient.fullName || "")
        );
        setPatients(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  /* ------------------------- Daily measures per user ---------------------- */
  async function fetchDailyMeasures(pid: string) {
    try {
      const qy = query(
        collection(db, "users", pid, "dailyMeasures"),
        orderBy("date", "desc")
      );
      const snap = await getDocs(qy);
      const data = snap.docs.map((d) => d.data() as DailyMeasure);
      setDailyMeasures((prev) => ({ ...prev, [pid]: data }));
    } catch (err) {
      console.error("Failed to fetch daily measures", err);
      setDailyMeasures((prev) => ({ ...prev, [pid]: [] }));
    }
  }

  /* ------------------------------ PDF download --------------------------- */
  async function generatePdfForPatient(
    pid: string,
    patient: Patient,
    appointments: Appointment[],
    records: RecordFile[]
  ) {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text("SmartCare Connect — Patient Report", 10, 16);

      doc.setFontSize(12);
      doc.text(`Patient: ${patient.fullName || "-"}`, 10, 30);
      doc.text(`Email: ${patient.email || "-"}`, 10, 38);
      doc.text(`Phone: ${patient.phone || "-"}`, 10, 46);
      doc.text(`DOB: ${patient.dob || "-"}`, 10, 54);
      doc.text(`Blood Group: ${patient.bloodGroup || "-"}`, 10, 62);
      doc.text(`Allergies: ${patient.allergies || "-"}`, 10, 70);
      doc.text(`Medications: ${patient.medications || "-"}`, 10, 78);

      let y = 92;
      doc.setFontSize(14);
      doc.text("Appointments", 10, y);
      y += 6;
      doc.setFontSize(10);

      if (appointments.length === 0) {
        doc.text("No appointments found.", 10, y);
        y += 8;
      } else {
        for (const a of appointments) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(
            `${safeDateTime(a.date)} | ${a.reason || "-"} | ${a.status}`,
            10,
            y
          );
          y += 6;

          if (a.notes) {
            doc.text(`Notes: ${a.notes}`, 12, y);
            y += 6;
          }
          if (a.attachments && a.attachments.length > 0) {
            doc.text("Attachments:", 12, y);
            y += 6;
            for (const file of a.attachments as Attachment[]) {
              if (y > 270) {
                doc.addPage();
                y = 20;
              }
              doc.text(`- ${file.fileName}`, 14, y);
              y += 6;
            }
          }
        }
      }

      doc.setFontSize(14);
      doc.text("Health Records", 10, y);
      y += 6;
      doc.setFontSize(10);

      if (records.length === 0) {
        doc.text("No records uploaded.", 10, y);
      } else {
        for (const r of records) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(`- ${r.fileName}`, 10, y);
          y += 6;
        }
      }

      doc.save(`${patient.fullName || pid}_report.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  }

  /* -------------------------------- Filtering ---------------------------- */
  const filtered = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.patient.fullName || "").toLowerCase().includes(q) ||
      (p.patient.email || "").toLowerCase().includes(q)
    );
  });

  /* ---------------------------------- UI --------------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-gray-900 to-gray-800 text-white p-6">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold flex items-center gap-2"
          >
            <User className="w-7 h-7 text-blue-400" />
            My Patients
          </motion.h1>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-72 bg-transparent px-3 py-2 placeholder:text-white/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Loading / Empty */}
        {loading && <p className="text-white/70">Loading patients…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-white/60">No patients found.</p>
        )}

        {/* List */}
        <div className="space-y-4">
          <AnimatePresence>
            {filtered.map((row) => {
              const open = expanded === row.patient.uid;
              const rawMeasures = dailyMeasures[row.patient.uid] || [];
              const measures = rawMeasures.map(normalize);
              const latest = measures[0];
              const latestBMI = calcBMI(latest?.weightKg, latest?.heightCm);

              // chart data asc by date
              const chartData = measures.slice().reverse();

              const pickNums = (k: keyof DailyMeasure) =>
                chartData
                  .map((d) =>
                    typeof d[k] === "number" ? (d[k] as number) : undefined
                  )
                  .filter((v): v is number => v != null);

              const domains = {
                systolic: calcTightDomain(pickNums("systolic"), 5),
                diastolic: calcTightDomain(pickNums("diastolic"), 5),
                sugarMgDl: calcTightDomain(pickNums("sugarMgDl"), 5),
                sugarPostMgDl: calcTightDomain(pickNums("sugarPostMgDl"), 5),
                cholesterolTotal: calcTightDomain(
                  pickNums("cholesterolTotal"),
                  10
                ),
                weightKg: calcTightDomain(pickNums("weightKg"), 0.5),
                spo2Pct: calcTightDomain(pickNums("spo2Pct"), 1),
                temperatureC: calcTightDomain(pickNums("temperatureC"), 0.2),
                waterIntakeL: calcTightDomain(pickNums("waterIntakeL"), 0.2),
              } as const;

              const hasSeries = (k: keyof DailyMeasure) =>
                chartData.some((d) => typeof d[k] === "number");

              return (
                <motion.section
                  key={row.patient.uid}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md"
                >
                  {/* Summary row (click to expand) */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const next = open ? null : row.patient.uid;
                      setExpanded(next);
                      if (!open) void fetchDailyMeasures(row.patient.uid);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const next = open ? null : row.patient.uid;
                        setExpanded(next);
                        if (!open) void fetchDailyMeasures(row.patient.uid);
                      }
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <h3 className="text-lg font-semibold">
                        {row.patient.fullName || "Unnamed"}
                      </h3>
                      <p className="text-white/70 text-sm">
                        {row.patient.email || "—"}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {open && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mt-5 space-y-6"
                      >
                        {/* Quick info */}
                        <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                          <p>
                            <span className="text-white/60">Phone:</span>{" "}
                            <span className="font-medium">
                              {row.patient.phone || "—"}
                            </span>
                          </p>
                          <p>
                            <span className="text-white/60">DOB:</span>{" "}
                            <span className="font-medium">
                              {row.patient.dob || "—"}
                            </span>
                          </p>
                          <p>
                            <span className="text-white/60">Blood Group:</span>{" "}
                            <span className="font-medium">
                              {row.patient.bloodGroup || "—"}
                            </span>
                          </p>
                          <p>
                            <span className="text-white/60">Allergies:</span>{" "}
                            <span className="font-medium">
                              {row.patient.allergies || "—"}
                            </span>
                          </p>
                          <p className="sm:col-span-2">
                            <span className="text-white/60">Medications:</span>{" "}
                            <span className="font-medium">
                              {row.patient.medications || "—"}
                            </span>
                          </p>
                        </div>

                        {/* Appointments */}
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 font-semibold">
                            <ClipboardList className="h-4 w-4 text-blue-300" />
                            Appointments
                          </h4>
                          {row.appointments.length === 0 ? (
                            <p className="text-white/70 text-sm">
                              No appointments found.
                            </p>
                          ) : (
                            <div className="grid gap-2">
                              {row.appointments.map((a) => (
                                <div
                                  key={a.id}
                                  className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm"
                                >
                                  <p>
                                    <span className="text-white/60">Date:</span>{" "}
                                    <span className="font-medium">
                                      {safeDateTime(a.date)}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="text-white/60">
                                      Reason:
                                    </span>{" "}
                                    <span className="font-medium">
                                      {a.reason || "—"}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="text-white/60">
                                      Status:
                                    </span>{" "}
                                    <span
                                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                        a.status === "completed"
                                          ? "bg-emerald-600"
                                          : a.status === "approved"
                                          ? "bg-blue-600"
                                          : a.status === "pending"
                                          ? "bg-yellow-600 text-black"
                                          : "bg-red-600"
                                      }`}
                                    >
                                      {a.status}
                                    </span>
                                  </p>

                                  {a.notes && (
                                    <p className="mt-2 rounded bg-white/5 p-2">
                                      <b>Notes:</b> {a.notes}
                                    </p>
                                  )}

                                  {/* Doctor attachments */}
                                  {a.attachments && a.attachments.length > 0 && (
                                    <div className="mt-2 rounded border border-white/10 bg-white/5 p-2">
                                      <b className="text-sm">Attachments:</b>
                                      <ul className="mt-1 list-disc pl-6">
                                        {(a.attachments as Attachment[]).map(
                                          (file) => (
                                            <li key={file.fileUrl}>
                                              <a
                                                href={file.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-300 hover:underline"
                                              >
                                                {file.fileName}
                                              </a>
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Records */}
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 font-semibold">
                            <FileText className="h-4 w-4 text-blue-300" />
                            Health Records
                          </h4>
                          {row.records.length === 0 ? (
                            <p className="text-white/70 text-sm">
                              No records uploaded.
                            </p>
                          ) : (
                            <div className="grid gap-2">
                              {row.records.map((r) => (
                                <a
                                  key={r.id}
                                  href={r.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="truncate rounded border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                                >
                                  {r.fileName}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Daily Measures (updated to match patient page) */}
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 font-semibold">
                            <Activity className="h-4 w-4 text-blue-300" />
                            Daily Measurements
                          </h4>

                          {measures.length === 0 ? (
                            <p className="text-white/70 text-sm">
                              No data available.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {/* Headline chips */}
                              {latest && (
                                <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4 grid gap-3 md:grid-cols-3 text-white">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80">
                                      Blood Pressure
                                    </span>
                                    {badge(
                                      statusBP(
                                        latest.systolic,
                                        latest.diastolic
                                      )
                                    )}
                                    {latest.systolic != null &&
                                      latest.diastolic != null && (
                                        <span className="text-xs text-white/60">
                                          {latest.systolic}/
                                          {latest.diastolic} mmHg
                                        </span>
                                      )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80">
                                      Fasting Sugar
                                    </span>
                                    {badge(
                                      statusSugarFasting(latest.sugarMgDl)
                                    )}
                                    {latest.sugarMgDl != null && (
                                      <span className="text-xs text-white/60">
                                        {latest.sugarMgDl} mg/dL
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80">
                                      2h Post Sugar
                                    </span>
                                    {badge(
                                      statusSugarPost(latest.sugarPostMgDl)
                                    )}
                                    {latest.sugarPostMgDl != null && (
                                      <span className="text-xs text-white/60">
                                        {latest.sugarPostMgDl} mg/dL
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80">
                                      Cholesterol
                                    </span>
                                    {badge(
                                      statusCholTotal(latest.cholesterolTotal)
                                    )}
                                    {latest.cholesterolTotal != null && (
                                      <span className="text-xs text-white/60">
                                        {latest.cholesterolTotal} mg/dL
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80">SpO₂</span>
                                    {badge(statusSpO2(latest.spo2Pct))}
                                    {latest.spo2Pct != null && (
                                      <span className="text-xs text-white/60">
                                        {latest.spo2Pct}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80">
                                      Temperature
                                    </span>
                                    {badge(statusTemp(latest.temperatureC))}
                                    {latest.temperatureC != null && (
                                      <span className="text-xs text-white/60">
                                        {latest.temperatureC} °C
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80">
                                      Weight
                                    </span>
                                    {badge(statusBMI(latestBMI))}
                                    {latest.weightKg != null && (
                                      <span className="text-xs text-white/60">
                                        {latest.weightKg} kg
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80">BMI</span>
                                    {badge(statusBMI(latestBMI))}
                                    {latestBMI != null && (
                                      <span className="text-xs text-white/60">
                                        {latestBMI} kg/m²
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Charts grid */}
                              <div className="grid gap-4 md:grid-cols-2">
                                {/* Blood Pressure */}
                                {hasSeries("systolic") && (
                                  <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="font-medium text-white/90">
                                        Blood Pressure
                                      </h3>
                                    </div>
                                    <ResponsiveContainer
                                      width="100%"
                                      height={140}
                                    >
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
                                  </div>
                                )}

                                {/* Fasting Sugar */}
                                {hasSeries("sugarMgDl") && (
                                  <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="font-medium text-white/90">
                                        Fasting Sugar
                                      </h3>
                                    </div>
                                    <ResponsiveContainer
                                      width="100%"
                                      height={140}
                                    >
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
                                  </div>
                                )}

                                {/* 2h Post Sugar */}
                                {hasSeries("sugarPostMgDl") && (
                                  <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="font-medium text-white/90">
                                        2h Post Meal Sugar
                                      </h3>
                                    </div>
                                    <ResponsiveContainer
                                      width="100%"
                                      height={140}
                                    >
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
                                  </div>
                                )}

                                {/* Total Cholesterol */}
                                {hasSeries("cholesterolTotal") && (
                                  <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="font-medium text-white/90">
                                        Total Cholesterol
                                      </h3>
                                    </div>
                                    <ResponsiveContainer
                                      width="100%"
                                      height={140}
                                    >
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
                                  </div>
                                )}

                                {/* SpO₂ */}
                                {hasSeries("spo2Pct") && (
                                  <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="font-medium text-white/90">
                                        SpO₂
                                      </h3>
                                    </div>
                                    <ResponsiveContainer
                                      width="100%"
                                      height={120}
                                    >
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
                                  </div>
                                )}

                                {/* Temperature */}
                                {hasSeries("temperatureC") && (
                                  <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="font-medium text-white/90">
                                        Temperature
                                      </h3>
                                    </div>
                                    <ResponsiveContainer
                                      width="100%"
                                      height={120}
                                    >
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
                                  </div>
                                )}

                                {/* Weight */}
                                {hasSeries("weightKg") && (
                                  <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="font-medium text-white/90">
                                        Weight
                                      </h3>
                                    </div>
                                    <ResponsiveContainer
                                      width="100%"
                                      height={140}
                                    >
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
                                        BMI: <b>{latestBMI}</b> (
                                        {statusBMI(latestBMI)})
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Water Intake */}
                                {hasSeries("waterIntakeL") && (
                                  <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="font-medium text-white/90">
                                        Daily Water Intake
                                      </h3>
                                    </div>
                                    <ResponsiveContainer
                                      width="100%"
                                      height={120}
                                    >
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
                                        {/* Good band based on LATEST weight (approx) */}
                                        {latest?.weightKg && (
                                          <ReferenceArea
                                            y1={Number(
                                              (0.03 * latest.weightKg).toFixed(2)
                                            )}
                                            y2={Number(
                                              (0.035 * latest.weightKg).toFixed(2)
                                            )}
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
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              generatePdfForPatient(
                                row.patient.uid,
                                row.patient,
                                row.appointments,
                                row.records
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-700"
                          >
                            <FileDown className="h-4 w-4" />
                            Download Patient Report (PDF)
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.section>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
