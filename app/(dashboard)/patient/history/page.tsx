"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByPatient, Appointment } from "@/lib/appointments";
import { getPatientRecords, RecordFile } from "@/lib/records";
import { getDoctorInfo } from "@/lib/doctors";
import {
  FileText,
  Download,
  Stethoscope,
  CalendarDays,
  FolderOpen,
} from "lucide-react";

// ------------------- Helpers -------------------
type DateLike = number | string | { toMillis: () => number } | null | undefined;

function toMillis(v: DateLike): number {
  if (!v && v !== 0) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof v === "object" && v && typeof (v as any).toMillis === "function") {
    try {
      return (v as any).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

function formatDate(v: DateLike): string {
  const ms = toMillis(v);
  if (!ms) return "-";
  try {
    return new Date(ms).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date(ms).toString();
  }
}

type AppointmentWithDoctor = Appointment & { doctorName?: string };

// ------------------- Component -------------------
export default function PatientHistoryPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[]>([]);
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // 1) Load all patient appointments
        const apps = await getAppointmentsByPatient(user.uid);

        // 2) Attach doctor names
        const withDocs = await Promise.all(
          apps.map(async (a) => {
            try {
              const docInfo = await getDoctorInfo(a.doctorId);
              const doctorName =
                (docInfo && (docInfo.fullName || docInfo.name)) || a.doctorId;
              return { ...(a as Appointment), doctorName };
            } catch {
              return { ...(a as Appointment), doctorName: a.doctorId };
            }
          })
        );

        withDocs.sort(
          (a, b) => toMillis(b.date as DateLike) - toMillis(a.date as DateLike)
        );

        // 3) Load uploaded patient records
        const recs = await getPatientRecords(user.uid);
        recs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        setAppointments(withDocs);
        setRecords(recs);
      } catch (e) {
        console.error(e);
        setErr("Failed to load medical history. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ------------------- PDF / Print (Formatted Layout) -------------------
  async function downloadPdfReport() {
    try {
      const mod = await import("jspdf");
      const { jsPDF } = mod;

      const doc = new jsPDF({ unit: "pt" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      let y = 60;

      // Helpers
      const line = (yy: number) => doc.line(40, yy, pageW - 40, yy);
      const addIfBreak = (nextHeight = 0) => {
        if (y + nextHeight > pageH - 60) {
          doc.addPage();
          y = 60;
        }
      };
      const sectionTitle = (title: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(title, 40, y);
        y += 8;
        doc.setDrawColor(180);
        line(y);
        y += 14;
      };
      const textRow = (label: string, value: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(label, 40, y);
        doc.setFont("helvetica", "normal");
        const text = value || "-";
        doc.text(text, 140, y);
        y += 18;
      };

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("Medical History Report", 40, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 40, y + 16);
      doc.text(`Patient: ${user?.email ?? "-"}`, 40, y + 30);
      y += 46;
      doc.setDrawColor(200);
      line(y);
      y += 24;

      // Summary
      sectionTitle("Summary");
      textRow("Total Appointments", String(appointments.length));
      textRow(
        "Completed",
        String(appointments.filter((a) => a.status === "completed").length)
      );
      textRow("Uploaded Records", String(records.length));
      y += 10;

      // Appointments Table
      sectionTitle("Appointments");
      // Table Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const colX = { date: 40, doctor: 180, status: 380, reason: 450 };
      const colW = {
        date: 120,
        doctor: 180,
        status: 80,
        reason: pageW - 40 - colX.reason,
      };

      doc.text("Date", colX.date, y);
      doc.text("Doctor", colX.doctor, y);
      doc.text("Status", colX.status, y);
      doc.text("Reason", colX.reason, y);
      y += 8;
      doc.setDrawColor(180);
      line(y);
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const wrapText = (text: string, width: number) =>
        doc.splitTextToSize(text || "-", width);

      for (const a of appointments) {
        const dateT = formatDate(a.date);
        const doctorT = a.doctorName || "-";
        const statusT = a.status || "-";
        const reasonLines = wrapText(a.reason || "-", colW.reason);

        // compute row height (max lines)
        const linesDoctor = doc.splitTextToSize(doctorT, colW.doctor);
        const rowLines = Math.max(reasonLines.length, linesDoctor.length, 1);
        const rowHeight = rowLines * 14;

        addIfBreak(rowHeight + 20);

        // Draw row text
        doc.text(dateT, colX.date, y);
        doc.text(linesDoctor, colX.doctor, y, { maxWidth: colW.doctor });
        doc.text(statusT, colX.status, y);
        doc.text(reasonLines, colX.reason, y, { maxWidth: colW.reason });

        y += rowHeight + 8;
        doc.setDrawColor(240);
        line(y);
        y += 12;
      }

      // Records
      addIfBreak(40);
      sectionTitle("Uploaded Records");
      if (records.length === 0) {
        doc.text("No records uploaded.", 40, y);
        y += 18;
      } else {
        doc.setFont("helvetica", "bold");
        doc.text("File Name", 40, y);
        doc.text("Uploaded At", 360, y);
        y += 8;
        doc.setDrawColor(180);
        line(y);
        y += 14;

        doc.setFont("helvetica", "normal");
        for (const r of records) {
          const fileLines = doc.splitTextToSize(r.fileName || "-", 300);
          const timeStr = formatDate(r.createdAt);
          const rowHeight = Math.max(fileLines.length * 14, 14);

          addIfBreak(rowHeight + 20);
          doc.text(fileLines, 40, y);
          doc.text(timeStr, 360, y);
          y += rowHeight + 8;
          doc.setDrawColor(240);
          line(y);
          y += 12;
        }
      }

      doc.save("medical-history.pdf");
    } catch (err) {
      console.error(err);
      alert("PDF generation failed. Please try again.");
    }
  }

  // ------------------- UI Helpers -------------------
  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-md">
      {children}
    </div>
  );

  const StatusBadge = ({ status }: { status?: string }) => {
    const s = (status || "").toLowerCase();
    const cls =
      s === "completed"
        ? "bg-emerald-600 text-white"
        : s === "pending"
        ? "bg-yellow-500 text-black"
        : s === "declined"
        ? "bg-red-600 text-white"
        : "bg-blue-600 text-white";
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
        {status || "-"}
      </span>
    );
  };

  // ------------------- Render -------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white py-10 px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold flex items-center gap-3"
          >
            <FileText className="h-7 w-7 text-blue-400" />
            My Medical History
          </motion.h2>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={downloadPdfReport}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 border border-white/10"
          >
            <Download className="h-4 w-4" />
            Download PDF Report
          </motion.button>
        </div>

        {/* Error */}
        {err && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* Summary Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <div className="p-4 flex items-center gap-3">
              <Stethoscope className="h-6 w-6 text-emerald-400" />
              <div>
                <div className="text-sm text-white/70">Total Appointments</div>
                <div className="text-xl font-semibold">
                  {appointments.length}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-4 flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-yellow-400" />
              <div>
                <div className="text-sm text-white/70">Completed</div>
                <div className="text-xl font-semibold">
                  {appointments.filter((a) => a.status === "completed").length}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-4 flex items-center gap-3">
              <FolderOpen className="h-6 w-6 text-blue-400" />
              <div>
                <div className="text-sm text-white/70">Uploaded Records</div>
                <div className="text-xl font-semibold">{records.length}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={`sk-${i}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse"
              >
                <div className="h-5 w-40 rounded bg-white/10 mb-3" />
                <div className="h-4 w-64 rounded bg-white/10 mb-2" />
                <div className="h-4 w-48 rounded bg-white/10 mb-2" />
                <div className="h-4 w-56 rounded bg-white/10" />
              </div>
            ))}
          </div>
        )}

        {/* Appointments */}
        {!loading && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Appointments</h3>
              <AnimatePresence mode="popLayout">
                {appointments.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white/60"
                  >
                    No appointments yet.
                  </motion.div>
                ) : (
                  appointments.map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <Card>
                        <div className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">{a.doctorName}</div>
                            <StatusBadge status={a.status} />
                          </div>
                          <div className="text-sm text-white/70">
                            <span className="text-white/50">Date:</span>{" "}
                            {formatDate(a.date)}
                          </div>
                          {a.reason && (
                            <div className="text-sm text-white/80">
                              <span className="text-white/50">Reason:</span>{" "}
                              {a.reason}
                            </div>
                          )}
                          {a.status === "completed" && a.notes && (
                            <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-sm">
                              <span className="font-medium">
                                Doctor’s Notes:
                              </span>{" "}
                              {a.notes}
                            </div>
                          )}
                          {a.status === "completed" &&
                            a.attachments &&
                            a.attachments.length > 0 && (
                              <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-sm">
                                <span className="font-medium">
                                  Doctor Attachments:
                                </span>
                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                  {a.attachments.map((file) => (
                                    <li key={file.fileUrl}>
                                      <a
                                        href={file.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline"
                                      >
                                        {file.fileName}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                        </div>
                      </Card>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Records */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Uploaded Records</h3>
              <Card>
                <div className="p-4 space-y-2">
                  {records.length === 0 ? (
                    <div className="text-white/60">
                      No records uploaded yet.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {records.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2"
                        >
                          <a
                            href={r.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {r.fileName}
                          </a>
                          <span className="text-xs text-white/60">
                            {formatDate(r.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
