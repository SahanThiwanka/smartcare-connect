"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByPatient, Appointment } from "@/lib/appointments";
import { getPatientRecords, RecordFile } from "@/lib/records";
import { getDoctorInfo } from "@/lib/doctors";

/**
 * Helper: convert possible Timestamp/number/string to millis (number).
 * Accepts:
 *  - number (ms)
 *  - ISO string
 *  - Firestore Timestamp object with toMillis()
 *  - undefined/null -> returns 0
 */
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

type AppointmentWithDoctor = Appointment & { doctorName?: string };

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
        // 1. Load appointments
        const apps = await getAppointmentsByPatient(user.uid);

        // attach doctor info (name fallback)
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

        // sort newest first (by appointment date)
        // sort newest first (by appointment date)
        withDocs.sort(
          (a, b) => toMillis(b.date as DateLike) - toMillis(a.date as DateLike)
        );

        // 2. Load records
        const recs = await getPatientRecords(user.uid);

        // sort newest first (by createdAt)
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

  // Compose printable HTML for the PDF / print window
  function buildPrintableHtml() {
    const title = `Medical History - ${user?.email ?? ""}`;
    const style = `
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #111 }
        h1 { font-size: 18px; margin-bottom: 8px }
        h2 { font-size: 14px; margin-top: 16px; margin-bottom: 8px }
        .section { margin-bottom: 12px }
        .item { margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #eee }
        .meta { color: #555; font-size: 12px }
        table { width: 100%; border-collapse: collapse }
        th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px }
      </style>
    `;

    const apptsHtml =
      appointments.length === 0
        ? `<p>No appointments.</p>`
        : `<table>
            <thead><tr><th>Date</th><th>Doctor</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              ${appointments
                .map(
                  (a) => `
                <tr>
                  <td>${formatDate(a.date)}</td>
                  <td>${a.doctorName ?? a.doctorId}</td>
                  <td>${(a.reason || "").replaceAll("\n", "<br/>")}</td>
                  <td>${a.status}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>`;

    const recsHtml =
      records.length === 0
        ? `<p>No records uploaded.</p>`
        : `<ul>
            ${records
              .map(
                (r) => `
              <li class="item">
                <div><strong>${r.fileName}</strong></div>
                <div class="meta">${formatDate(r.createdAt)} • <a href="${
                  r.fileUrl
                }" target="_blank">Open</a></div>
              </li>
            `
              )
              .join("")}
          </ul>`;

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>${title}</title>
          ${style}
        </head>
        <body>
          <h1>${title}</h1>
          <div class="section">
            <h2>Appointments</h2>
            ${apptsHtml}
          </div>
          <div class="section">
            <h2>Uploaded Records</h2>
            ${recsHtml}
          </div>
        </body>
      </html>`;
  }

  // Try to use jsPDF if available (optional). If not installed, fallback to print window.
  async function downloadPdfReport() {
    // first try jsPDF (if user installed it)
    try {
      // dynamic import; works only if jspdf is installed in the project
      const mod = await import("jspdf");
      const { jsPDF } = mod;
      const doc = new jsPDF();

      // Simple text-based PDF output (keeps dependency usage minimal)
      doc.setFontSize(14);
      doc.text(`Medical History - ${user?.email ?? ""}`, 10, 14);
      doc.setFontSize(10);
      let y = 24;

      doc.text("Appointments:", 10, y);
      y += 6;
      for (const a of appointments) {
        const line = `${formatDate(a.date)} | ${a.doctorName || a.doctorId} | ${
          a.status
        }`;
        doc.text(line, 10, y);
        y += 6;
        const reasonLines = (a.reason || "").split("\n");
        for (const rl of reasonLines) {
          doc.text(`  ${rl}`, 12, y);
          y += 6;
          if (y > 280) {
            doc.addPage();
            y = 20;
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
        const line = `${r.fileName} • ${formatDate(r.createdAt)}`;
        doc.text(line, 10, y);
        y += 6;
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
      }

      doc.save("medical-history.pdf");
      return;
    } catch (err) {
      // jsPDF not installed or failed — fallback to print-to-PDF
      console.info("jsPDF not available, falling back to print window.", err);
    }

    const html = buildPrintableHtml();
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      alert("Unable to open new window. Please allow popups to download PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();

    // Wait a tick for the content to render, then call print
    w.focus();
    // call print, user can save as PDF
    setTimeout(() => {
      try {
        w.print();
      } catch (e) {
        console.warn("Print failed:", e);
      }
    }, 500);
  }

  return (
    <div className="max-w-4xl mx-auto grid gap-8 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Medical History</h2>
        <div>
          <button
            onClick={downloadPdfReport}
            className="rounded bg-black text-white px-4 py-2"
          >
            Download PDF Report
          </button>
        </div>
      </div>

      {loading && <p>Loading...</p>}

      {/* Appointment History */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Appointments</h3>
        {appointments.length === 0 && <p>No appointments yet.</p>}
        <div className="grid gap-3">
          {appointments.map((a) => (
            <div key={a.id} className="rounded border p-3">
              <p>
                <span className="font-semibold">Doctor:</span> {a.doctorName}
              </p>
              <p>
                <span className="font-semibold">Date:</span>{" "}
                {formatDate(a.date)}
              </p>
              <p>
                <span className="font-semibold">Reason:</span> {a.reason}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{" "}
                <span
                  className={`px-2 py-0.5 rounded text-sm ${
                    a.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : a.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : a.status === "declined"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {a.status}
                </span>
              </p>
              {a.status === "completed" && a.notes && (
                <p className="mt-2 p-2 rounded bg-gray-600 text-sm">
                  <span className="font-semibold">Doctor’s Notes:</span>{" "}
                  {a.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Health Records */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Uploaded Records</h3>
        {records.length === 0 && <p>No records uploaded yet.</p>}
        <div className="grid gap-2">
          {records.map((r) => (
            <div
              key={r.id}
              className="flex justify-between items-center border rounded p-2"
            >
              <a
                href={r.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {r.fileName}
              </a>
              <span className="text-sm text-gray-500">
                {formatDate(r.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
