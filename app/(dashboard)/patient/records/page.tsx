/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback, FormEvent, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Appointment,
} from "@/lib/appointments";
import { getDoctorInfo } from "@/lib/doctors";
import {
  Upload,
  FileDown,
  Trash2,
  Eye,
  Loader2,
  Stethoscope,
  User2,
} from "lucide-react";

/* ─────────────────────────────── Types & helpers ───────────────────────────── */

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

type TimestampLike = number | string | { toMillis: () => number };

const toMillis = (v: TimestampLike | null | undefined): number => {
  if (!v && v !== 0) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
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

const formatWhen = (v: TimestampLike): string =>
  new Date(toMillis(v)).toLocaleString();

/* ─────────────────────────────── UI atoms ───────────────────────────── */

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={`rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-md ${
      className ?? ""
    }`}
  >
    {children}
  </div>
);

const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "solid" | "ghost";
  }
> = ({ children, className, variant = "solid", ...props }) => (
  <button
    {...props}
    className={[
      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
      variant === "solid"
        ? "bg-blue-600 text-white hover:bg-blue-500 disabled:bg-blue-900/40"
        : "border border-white/10 bg-white/5 text-white/90 hover:bg-white/10",
      className ?? "",
    ].join(" ")}
  >
    {children}
  </button>
);

/* ─────────────────────────────── Main Page ───────────────────────────── */

export default function PatientRecordsPage() {
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [records, setRecords] = useState<RecordFile[]>([]);
  const [doctorAttachments, setDoctorAttachments] = useState<
    DoctorAttachment[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null); // for delete spinners

  const loadRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 1) Patient uploads
      const recs = await getPatientRecords(user.uid);
      recs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setRecords(recs);

      // 2) Attachments uploaded by doctors (inside appointments)
      const apps: Appointment[] = await getAppointmentsByPatient(user.uid);
      const docs: DoctorAttachment[] = [];

      for (const a of apps) {
        const attachments = a.attachments ?? [];
        if (!Array.isArray(attachments) || attachments.length === 0) continue;

        let docName: string = a.doctorId;
        try {
          const info = await getDoctorInfo(a.doctorId);
          docName = info?.fullName || info?.name || a.doctorId;
        } catch {
          // ignore and keep fallback
        }

        for (const att of attachments) {
          docs.push({
            fileName: att.fileName ?? "Attachment",
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
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  /* ───────────── Upload ───────────── */

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;

    setUploading(true);
    try {
      await uploadRecord(user.uid, file);
      setFile(null);
      await loadRecords();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  /* ───────────── Delete (patient file) ───────────── */

  const onDeletePatientRecord = async (
    r: RecordFile & { storagePath?: string }
  ) => {
    if (!r.id) return;
    if (!confirm(`Delete "${r.fileName}"?`)) return;

    setBusyId(r.id);
    try {
      await deleteRecord(r.id, r.storagePath);
      await loadRecords();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed.");
    } finally {
      setBusyId(null);
    }
  };

  /* ───────────── Delete (doctor attachment) ───────────── */

  const onDeleteDoctorAttachment = async (att: DoctorAttachment) => {
    if (!att.appointmentId) return;
    if (!att.storagePath && !att.fileUrl) {
      alert("Cannot delete: missing storage path.");
      return;
    }
    if (!confirm(`Delete "${att.fileName}" from doctor?`)) return;

    const busyKey = `${att.appointmentId}:${att.fileUrl}`;
    setBusyId(busyKey);
    try {
      await removeAppointmentAttachment(
        att.appointmentId,
        att.fileUrl,
        att.storagePath ?? undefined
      );
      await loadRecords();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed.");
    } finally {
      setBusyId(null);
    }
  };

  /* ───────────── Derived ───────────── */

  const hasAny = useMemo(
    () => records.length > 0 || doctorAttachments.length > 0,
    [records.length, doctorAttachments.length]
  );

  /* ───────────── UI ───────────── */

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white py-10 px-6">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <motion.h1
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-center"
        >
          🗂️ My Health Records
        </motion.h1>

        {/* Upload */}
        <Card className="p-5">
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <label
                htmlFor="file"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Select file</span>
              </label>
              <input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-white/70 text-sm">
                {file ? file.name : "PDF, JPG, PNG · up to 10MB"}
              </span>
            </div>

            <Button type="submit" disabled={!file || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Sections */}
        <div className="grid gap-8 lg:grid-cols-1">
          {/* Doctor Attachments */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-emerald-400" />
                  Doctor Attachments
                </h2>
              </div>

              {loading ? (
                <SkeletonList />
              ) : doctorAttachments.length === 0 ? (
                <EmptyState text="No attachments from doctors yet." />
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence initial={false}>
                    {doctorAttachments.map((d, i) => {
                      const key = `${d.appointmentId}-${i}`;
                      const busyKey = `${d.appointmentId}:${d.fileUrl}`;
                      const isBusy = busyId === busyKey;

                      return (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="rounded-lg border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {d.fileName}
                              </p>
                              <p className="text-xs text-white/60">
                                by <b>{d.doctorName ?? "Doctor"}</b> —{" "}
                                {formatWhen(d.createdAt)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="ghost"
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
                              >
                                <Eye className="h-4 w-4" />
                                Preview
                              </Button>

                              <a
                                href={d.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                              >
                                <FileDown className="h-4 w-4" />
                                View
                              </a>

                              {d.storagePath ? (
                                <Button
                                  onClick={() => onDeleteDoctorAttachment(d)}
                                  disabled={isBusy}
                                  className="bg-red-600 hover:bg-red-500"
                                >
                                  {isBusy ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Deleting…
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </>
                                  )}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Patient Uploads */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <User2 className="h-5 w-5 text-blue-400" />
                  My Uploads
                </h2>
              </div>

              {loading ? (
                <SkeletonList />
              ) : records.length === 0 ? (
                <EmptyState text="You haven’t uploaded any records yet." />
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence initial={false}>
                    {records.map((r) => {
                      const isBusy = busyId === r.id;
                      return (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="rounded-lg border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {r.fileName}
                              </p>
                              <p className="text-xs text-white/60">
                                Uploaded by you — {formatWhen(r.createdAt)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setPreview({
                                    fileName: r.fileName,
                                    fileUrl: r.fileUrl,
                                    createdAt: r.createdAt,
                                    source: "patient",
                                  })
                                }
                              >
                                <Eye className="h-4 w-4" />
                                Preview
                              </Button>

                              <a
                                href={r.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                              >
                                <FileDown className="h-4 w-4" />
                                View
                              </a>

                              <Button
                                onClick={() =>
                                  onDeletePatientRecord(
                                    r as RecordFile & { storagePath?: string }
                                  )
                                }
                                disabled={isBusy}
                                className="bg-red-600 hover:bg-red-500"
                              >
                                {isBusy ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Deleting…
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Empty page helper */}
        {!loading && !hasAny && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-8 text-center">
              <p className="text-white/70">
                No records yet. Use the uploader above to add your first file.
              </p>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {preview && (
          <motion.div
            key="preview-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          >
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-gray-900 p-4 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-white">
                      {preview.fileName}
                    </h3>
                    <p className="text-xs text-white/60">
                      {preview.source === "doctor"
                        ? `Uploaded by: ${preview.meta?.doctorName ?? "Doctor"}`
                        : "Uploaded by: You"}{" "}
                      • {formatWhen(preview.createdAt)}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => setPreview(null)}>
                    Close
                  </Button>
                </div>

                <div className="rounded-lg bg-white p-2">
                  {renderPreview(preview)}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────── Small helpers ───────────────────────────── */

function renderPreview(p: PreviewItem) {
  const ext = p.fileName.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return (
      <img
        src={p.fileUrl}
        alt={p.fileName}
        className="mx-auto max-h-[70vh] w-auto object-contain"
      />
    );
  }
  if (ext === "pdf") {
    return (
      <iframe
        src={p.fileUrl}
        title="PDF Preview"
        className="h-[70vh] w-full rounded"
      />
    );
  }
  return (
    <div className="p-6 text-center text-gray-700">
      Preview not available for this file type.
    </div>
  );
}

const SkeletonList: React.FC = () => (
  <div className="grid gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="animate-pulse rounded-lg border border-white/10 bg-white/5 p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="h-4 w-48 rounded bg-white/10" />
          <div className="h-8 w-40 rounded bg-white/10" />
        </div>
        <div className="mt-2 h-3 w-56 rounded bg-white/10" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-white/70">
    {text}
  </div>
);
