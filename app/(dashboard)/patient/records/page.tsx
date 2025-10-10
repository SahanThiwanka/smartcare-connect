"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  uploadRecord,
  getPatientRecords,
  deleteRecord,
  RecordFile,
} from "@/lib/records";
import {
  getAppointmentsByPatient,
  removeAppointmentAttachment,
} from "@/lib/appointments";
import { getDoctorInfo } from "@/lib/doctors";
import Image from "next/image";

type DoctorAttachment = {
  fileName: string;
  fileUrl: string;
  createdAt: number | string;
  appointmentId?: string;
  storagePath?: string | null;
  doctorName?: string;
};

type PreviewItem = {
  fileName: string;
  fileUrl: string;
  createdAt: number | string;
  source: "patient" | "doctor";
  meta?: {
    appointmentId?: string;
    storagePath?: string | null;
    doctorName?: string;
  };
};

export default function PatientRecordsPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [doctorAttachments, setDoctorAttachments] = useState<
    DoctorAttachment[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  // helper to normalize createdAt -> ms
  const toMillis = (v: any): number => {
    if (!v && v !== 0) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const t = Date.parse(v);
      return isNaN(t) ? 0 : t;
    }
    if (typeof v === "object" && typeof v.toMillis === "function") {
      try {
        return v.toMillis();
      } catch {
        return 0;
      }
    }
    return 0;
  };

  const loadRecords = useCallback(async () => {
    if (!user) return;
    // 1) load patient uploaded records collection
    const recs = await getPatientRecords(user.uid);
    recs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    setRecords(recs);

    // 2) load doctor attachments embedded in appointments
    const apps = await getAppointmentsByPatient(user.uid);

    const docs: DoctorAttachment[] = [];

    for (const a of apps) {
      if (
        !Array.isArray((a as any).attachments) ||
        (a as any).attachments.length === 0
      ) {
        continue;
      }

      // fetch doctor info once per appointment
      let docName = undefined;
      try {
        const info = await getDoctorInfo(a.doctorId);
        docName = info?.fullName || info?.name || a.doctorId;
      } catch {
        docName = a.doctorId;
      }

      for (const att of (a as any).attachments) {
        docs.push({
          fileName: att.fileName || att.name || "Attachment",
          fileUrl: att.fileUrl,
          createdAt: att.uploadedAt ?? a.date ?? Date.now(),
          appointmentId: a.id,
          storagePath: att.storagePath ?? null,
          doctorName: docName,
        });
      }
    }

    docs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    setDoctorAttachments(docs);
  }, [user]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // upload patient record
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;
    setLoading(true);
    try {
      await uploadRecord(user.uid, file);
      await loadRecords();
      setFile(null);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  // delete patient record
  const onDeletePatientRecord = async (r: RecordFile) => {
    if (!r.id) return;
    if (!confirm("Delete this record?")) return;
    await deleteRecord(r.id, (r as any).storagePath);
    await loadRecords();
  };

  // delete doctor appointment attachment (only if storagePath present)
  const onDeleteDoctorAttachment = async (att: DoctorAttachment) => {
    if (!att.appointmentId) return;
    if (!att.storagePath && !att.fileUrl) {
      alert("Cannot delete: no storage path saved for this attachment.");
      return;
    }
    if (!confirm("Delete this doctor attachment?")) return;
    await removeAppointmentAttachment(
      att.appointmentId,
      att.fileUrl,
      att.storagePath ?? undefined
    );
    await loadRecords();
  };

  // Preview rendering (pdf/images)
  const renderPreview = (p: PreviewItem) => {
    const ext = p.fileName.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png"].includes(ext || "")) {
      return (
        // next/image requires domain config; using plain <img> to keep preview working everywhere
        <img
          src={p.fileUrl}
          alt={p.fileName}
          className="max-h-[70vh] mx-auto object-contain"
        />
      );
    }
    if (ext === "pdf") {
      return (
        <iframe
          src={p.fileUrl}
          className="w-full h-[70vh]"
          title="PDF Preview"
        />
      );
    }
    return (
      <p className="text-gray-500">Preview not available for this file type.</p>
    );
  };

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold">My Health Records</h2>

      <form onSubmit={onSubmit} className="flex items-center gap-3">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white"
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {/* Doctor Attachments */}
      <div>
        <h3 className="text-lg font-semibold text-red-600">
          🩺 Doctor Attachments
        </h3>
        {doctorAttachments.length === 0 ? (
          <p className="text-gray-400">No attachments from doctors found.</p>
        ) : (
          <div className="grid gap-3">
            {doctorAttachments.map((d, i) => (
              <div
                key={`${d.appointmentId}-${i}`}
                className="rounded border p-3 flex justify-between items-center bg-black"
              >
                <div>
                  <p className="font-medium">{d.fileName}</p>
                  <p className="text-sm text-gray-400">
                    Uploaded by: <b>{d.doctorName ?? "Doctor"}</b>
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(toMillis(d.createdAt)).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-3 items-center">
                  <button
                    onClick={() =>
                      setPreview({
                        fileName: d.fileName,
                        fileUrl: d.fileUrl,
                        createdAt: d.createdAt,
                        source: "doctor",
                        meta: {
                          appointmentId: d.appointmentId,
                          storagePath: d.storagePath,
                          doctorName: d.doctorName,
                        },
                      })
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Preview
                  </button>

                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline"
                  >
                    View
                  </a>

                  {/* Only show delete if we have a storage path (so we can also remove storage object) */}
                  {d.storagePath ? (
                    <button
                      onClick={() => onDeleteDoctorAttachment(d)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Patient Uploads */}
      <div>
        <h3 className="text-lg font-semibold text-green-600">👤 My Uploads</h3>
        {records.length === 0 ? (
          <p className="text-gray-400">You haven’t uploaded any records yet.</p>
        ) : (
          <div className="grid gap-3">
            {records.map((r) => (
              <div
                key={r.id}
                className="rounded border p-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium">{r.fileName}</p>
                  <p className="text-sm text-gray-500">Uploaded by: You</p>
                  <p className="text-xs text-gray-400">
                    {new Date(toMillis(r.createdAt)).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-3 items-center">
                  <button
                    onClick={() =>
                      setPreview({
                        fileName: r.fileName,
                        fileUrl: r.fileUrl,
                        createdAt: r.createdAt,
                        source: "patient",
                        meta: {},
                      })
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Preview
                  </button>
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline"
                  >
                    View
                  </a>
                  <button
                    onClick={() => onDeletePatientRecord(r)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-700 p-4 rounded max-w-3xl w-full relative">
            <button
              onClick={() => setPreview(null)}
              className="absolute top-2 right-2 text-red-500 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-3 text-white">
              {preview.fileName}
            </h3>
            <div className="bg-white p-2 rounded">{renderPreview(preview)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
