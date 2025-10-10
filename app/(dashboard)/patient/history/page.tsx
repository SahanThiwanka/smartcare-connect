"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByPatient, Appointment } from "@/lib/appointments";
import { getPatientRecords, RecordFile } from "@/lib/records";
import { getDoctorInfo } from "@/lib/doctors";

// ------------------- Helpers -------------------
type DateLike = number | string | { toMillis: () => number } | null | undefined;

function toMillis(v: DateLike): number {
  if (!v && v !== 0) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof v === "object" && v && typeof v.toMillis === "function") {
    try {
      return v.toMillis();
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

// ------------------- Types -------------------
type AppointmentWithDoctor = Appointment & { doctorName?: string };

// ------------------- Component -------------------
export default function PatientHistoryPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[]>([]);
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        // 1️⃣ Load all patient appointments
        const apps = await getAppointmentsByPatient(user.uid);

        // 2️⃣ Attach doctor info (name fallback)
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

        // sort by most recent date
        withDocs.sort(
          (a, b) => toMillis(b.date as DateLike) - toMillis(a.date as DateLike)
        );

        // 3️⃣ Load uploaded patient records
        const recs = await getPatientRecords(user.uid);
        recs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        setAppointments(withDocs);
        setRecords(recs);
      } catch (err) {
        console.error("Failed loading history:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ------------------- PDF / Print -------------------
  async function downloadPdfReport() {
    try {
      const mod = await import("jspdf");
      const { jsPDF } = mod;
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(`Medical History - ${user?.email ?? ""}`, 10, 14);
      doc.setFontSize(10);
      let y = 24;

      doc.text("Appointments:", 10, y);
      y += 6;
      for (const a of appointments) {
        const line = `${formatDate(a.date)} | ${a.doctorName} | ${a.status}`;
        doc.text(line, 10, y);
        y += 6;
        const reasonLines = (a.reason || "").split("\n");
        for (const rl of reasonLines) {
          doc.text(`  ${rl}`, 12, y);
          y += 6;
        }
        if (a.attachments && a.attachments.length > 0) {
          doc.text("  Attachments:", 12, y);
          y += 6;
          for (const att of a.attachments) {
            doc.text(`   - ${att.fileName}`, 14, y);
            y += 6;
          }
        }
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      }

      y += 8;
      doc.text("Records:", 10, y);
      y += 6;
      for (const r of records) {
        doc.text(`${r.fileName} • ${formatDate(r.createdAt)}`, 10, y);
        y += 6;
      }

      doc.save("medical-history.pdf");
    } catch (err) {
      alert("PDF generation failed, please try again.");
      console.error(err);
    }
  }

  // ------------------- Render -------------------
  return (
    <div className="max-w-4xl mx-auto grid gap-8 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Medical History</h2>
        <button
          onClick={downloadPdfReport}
          className="rounded bg-black text-white px-4 py-2"
        >
          Download PDF Report
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {/* 🩺 Appointment History */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Appointments</h3>
        {appointments.length === 0 && <p>No appointments yet.</p>}
        <div className="grid gap-3">
          {appointments.map((a) => (
            <div key={a.id} className="rounded border p-3 bg-black text-white">
              <p>
                <b>Doctor:</b> {a.doctorName}
              </p>
              <p>
                <b>Date:</b> {formatDate(a.date)}
              </p>
              <p>
                <b>Reason:</b> {a.reason}
              </p>
              <p>
                <b>Status:</b>{" "}
                <span
                  className={`px-2 py-0.5 rounded text-sm ${
                    a.status === "completed"
                      ? "bg-green-700 text-white"
                      : a.status === "pending"
                      ? "bg-yellow-600 text-black"
                      : a.status === "declined"
                      ? "bg-red-600 text-white"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  {a.status}
                </span>
              </p>

              {/* ✅ Show doctor notes */}
              {a.status === "completed" && a.notes && (
                <p className="mt-2 p-2 rounded bg-gray-700 text-sm">
                  <b>Doctor’s Notes:</b> {a.notes}
                </p>
              )}

              {/* ✅ Show doctor-uploaded files */}
              {a.status === "completed" &&
                a.attachments &&
                a.attachments.length > 0 && (
                  <div className="mt-3 p-2 border rounded bg-gray-800 text-sm">
                    <b>Doctor Attachments:</b>
                    <ul className="list-disc pl-6 mt-1">
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
          ))}
        </div>
      </div>

      {/* 📂 Health Records */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Uploaded Records</h3>
        {records.length === 0 && <p>No records uploaded yet.</p>}
        <div className="grid gap-2">
          {records.map((r) => (
            <div
              key={r.id}
              className="flex justify-between items-center border rounded p-2 bg-gray-700 text-white"
            >
              <a
                href={r.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                {r.fileName}
              </a>
              <span className="text-sm text-gray-300">
                {formatDate(r.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
