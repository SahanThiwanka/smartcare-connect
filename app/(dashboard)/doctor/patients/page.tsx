"use client";

import { useEffect, useState, Suspense } from "react";
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
  Legend,
  ResponsiveContainer,
} from "recharts";
import { FileDown, Activity, User, ClipboardList, FileText, ChevronDown } from "lucide-react";

/* --------------------------------- Types --------------------------------- */

type DailyMeasure = {
  date: string;          // YYYY-MM-DD
  pressure?: string;
  cholesterol?: string;
  sugar?: string;
  spo2?: string;
  exerciseTime?: string;
  temperature?: string;
  weight?: string;
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

/* -------------------------------- Component ------------------------------ */

export default function DoctorPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientWithHistory[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [dailyMeasures, setDailyMeasures] = useState<Record<string, DailyMeasure[]>>({});

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
            // Keep going on individual failures
            console.error("Failed to load a patient row:", err);
          }
        }

        // Sort patients by name for consistent order
        rows.sort((a, b) => (a.patient.fullName || "").localeCompare(b.patient.fullName || ""));
        setPatients(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  /* ------------------------- Daily measures per user ---------------------- */
  async function fetchDailyMeasures(pid: string) {
    try {
      const q = query(collection(db, "users", pid, "dailyMeasures"), orderBy("date", "desc"));
      const snap = await getDocs(q);
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
          doc.text(`${safeDateTime(a.date)} | ${a.reason || "-"} | ${a.status}`, 10, y);
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
              const measures = dailyMeasures[row.patient.uid] || [];

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
                      <h3 className="text-lg font-semibold">{row.patient.fullName || "Unnamed"}</h3>
                      <p className="text-white/70 text-sm">{row.patient.email || "—"}</p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
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
                            <span className="font-medium">{row.patient.phone || "—"}</span>
                          </p>
                          <p>
                            <span className="text-white/60">DOB:</span>{" "}
                            <span className="font-medium">{row.patient.dob || "—"}</span>
                          </p>
                          <p>
                            <span className="text-white/60">Blood Group:</span>{" "}
                            <span className="font-medium">{row.patient.bloodGroup || "—"}</span>
                          </p>
                          <p>
                            <span className="text-white/60">Allergies:</span>{" "}
                            <span className="font-medium">{row.patient.allergies || "—"}</span>
                          </p>
                          <p className="sm:col-span-2">
                            <span className="text-white/60">Medications:</span>{" "}
                            <span className="font-medium">{row.patient.medications || "—"}</span>
                          </p>
                        </div>

                        {/* Appointments */}
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 font-semibold">
                            <ClipboardList className="h-4 w-4 text-blue-300" />
                            Appointments
                          </h4>
                          {row.appointments.length === 0 ? (
                            <p className="text-white/70 text-sm">No appointments found.</p>
                          ) : (
                            <div className="grid gap-2">
                              {row.appointments.map((a) => (
                                <div
                                  key={a.id}
                                  className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm"
                                >
                                  <p>
                                    <span className="text-white/60">Date:</span>{" "}
                                    <span className="font-medium">{safeDateTime(a.date)}</span>
                                  </p>
                                  <p>
                                    <span className="text-white/60">Reason:</span>{" "}
                                    <span className="font-medium">{a.reason || "—"}</span>
                                  </p>
                                  <p>
                                    <span className="text-white/60">Status:</span>{" "}
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
                                        {(a.attachments as Attachment[]).map((file) => (
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
                                        ))}
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
                            <p className="text-white/70 text-sm">No records uploaded.</p>
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

                        {/* Daily Measures */}
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 font-semibold">
                            <Activity className="h-4 w-4 text-blue-300" />
                            Daily Measurements
                          </h4>

                          {measures.length === 0 ? (
                            <p className="text-white/70 text-sm">No data available.</p>
                          ) : (
                            <div className="space-y-3">
                              <div className="rounded border border-white/10 bg-white/5 p-2 text-sm">
                                <b>Latest Entry:</b> {measures[0].date}
                              </div>

                              <div style={{ width: "100%", height: 220 }}>
                                <Suspense fallback={<p className="text-sm">Loading chart…</p>}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={measures.slice().reverse()}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey="date" />
                                      <YAxis />
                                      <Tooltip />
                                      <Legend />
                                      <Line type="monotone" dataKey="pressure" stroke="#60a5fa" name="Pressure" />
                                      <Line type="monotone" dataKey="sugar" stroke="#f87171" name="Sugar" />
                                      <Line type="monotone" dataKey="weight" stroke="#34d399" name="Weight" />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </Suspense>
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
