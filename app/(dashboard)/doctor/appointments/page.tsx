"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAppointmentsByDoctor,
  approveAppointment,
  declineAppointment,
  completeAppointment,
  Appointment,
} from "@/lib/appointments";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Link from "next/link";

// ---------------- Types ----------------
type FirestorePatient = {
  fullName?: string;
  email?: string;
  phone?: string;
};

type PatientInfo = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
};

type Attachment = {
  fileName: string;
  fileUrl: string;
  storagePath: string;
  uploadedAt: number;
};

type StatusFilter = "all" | "pending" | "approved" | "completed" | "declined";

// ---------------- Helpers ----------------
function fmtDate(d?: string | number | Date): string {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function badgeClasses(status: Appointment["status"]): string {
  switch (status) {
    case "pending":
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    case "approved":
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "completed":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "declined":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    default:
      return "bg-white/10 text-white/70 border-white/20";
  }
}

// ---------------- Component ----------------
export default function DoctorAppointmentsPage() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Record<string, PatientInfo>>({});
  const [loading, setLoading] = useState<boolean>(false);

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  // ---------- Load appointments + patient cache ----------
  const loadAppointments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const apps = await getAppointmentsByDoctor(user.uid);

      // Sort: newest first
      apps.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setAppointments(apps);

      // Build patient map (avoid duplicate fetches)
      const needIds = Array.from(new Set(apps.map((a) => a.patientId))).filter(
        (id) => !patients[id]
      );

      if (needIds.length) {
        const entries = await Promise.all(
          needIds.map(async (pid) => {
            const snap = await getDoc(doc(db, "users", pid));
            const data = snap.exists() ? (snap.data() as FirestorePatient) : {};
            const info: PatientInfo = {
              id: pid,
              fullName: data.fullName ?? "Unknown",
              email: data.email ?? "-",
              phone: data.phone ?? "-",
            };
            return [pid, info] as const;
          })
        );
        setPatients((prev) => {
          const next = { ...prev };
          for (const [pid, info] of entries) next[pid] = info;
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, patients]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  // ---------- File handling ----------
  const handleFileChange = (
    appointmentId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    setFiles((prev) => ({ ...prev, [appointmentId]: selected }));
  };

  const uploadFiles = async (
    appointmentId: string,
    filesToUpload: File[]
  ): Promise<Attachment[]> => {
    const results: Attachment[] = [];
    for (const file of filesToUpload) {
      const path = `appointments/${appointmentId}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      results.push({
        fileName: file.name,
        fileUrl: url,
        storagePath: path,
        uploadedAt: Date.now(),
      });
    }
    return results;
  };

  // ---------- Actions ----------
  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await approveAppointment(id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "approved" } : a))
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (id: string) => {
    setBusyId(id);
    try {
      await declineAppointment(id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "declined" } : a))
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (id: string) => {
    if (!notes[id] || !notes[id].trim()) {
      alert("Please add notes before marking as completed.");
      return;
    }
    setBusyId(id);
    try {
      // Upload new files if any
      const newFiles = files[id] && files[id].length > 0 ? files[id] : [];
      const uploaded = newFiles.length ? await uploadFiles(id, newFiles) : [];

      // Merge with existing attachments, if any
      const appt = appointments.find((a) => a.id === id);
      const existing = (appt?.attachments as Attachment[] | undefined) ?? [];
      const merged = [...existing, ...uploaded];

      // Mark complete + persist notes
      await completeAppointment(id, notes[id]);

      // Update attachments
      await updateDoc(doc(db, "appointments", id), { attachments: merged });

      // Local state update
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: "completed",
                notes: notes[id],
                attachments: merged,
              }
            : a
        )
      );

      // Clear form state for that appointment
      setNotes((prev) => ({ ...prev, [id]: "" }));
      setFiles((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setBusyId(null);
    }
  };

  // ---------- Derived lists (search + filter) ----------
  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;

      if (!q) return true;
      const patient = patients[a.patientId];
      const hay = [
        patient?.fullName || "",
        patient?.email || "",
        a.reason || "",
        a.status,
        fmtDate(a.date),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [appointments, patients, filter, search]);

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Appointments</h2>
            <p className="text-white/60 text-sm">
              Approve, decline, complete with notes & attachments — or open the AI tools.
            </p>
          </div>

          {/* Search */}
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient, reason, status, or date…"
              className="w-72 bg-transparent placeholder:text-white/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              "all",
              "pending",
              "approved",
              "completed",
              "declined",
            ] as StatusFilter[]
          ).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                filter === f
                  ? "bg-white/20 border-white/30"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        {loading && <p className="text-white/70">Loading appointments…</p>}
        {!loading && filteredAppointments.length === 0 && (
          <p className="text-white/60">No matching appointments.</p>
        )}

        <div className="grid gap-4">
          {filteredAppointments.map((a) => {
            const p = patients[a.patientId];
            const isBusy = busyId === a.id;

            return (
              <section
                key={a.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur"
              >
                {/* Top row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {p?.fullName || a.patientId}
                    </h3>
                    <p className="text-sm text-white/70">
                      {p?.email || "-"} • {p?.phone || "-"}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${badgeClasses(
                      a.status
                    )}`}
                  >
                    {a.status}
                  </span>
                </div>

                {/* Details */}
                <div className="mt-3 grid gap-2 text-sm">
                  <p>
                    <span className="text-white/60">Date:</span>{" "}
                    <span className="font-medium">{fmtDate(a.date)}</span>
                  </p>
                  <p>
                    <span className="text-white/60">Reason:</span>{" "}
                    <span className="font-medium">{a.reason || "—"}</span>
                  </p>

                  {a.notes && (
                    <p className="rounded bg-white/5 p-2">
                      <b>Notes:</b> {a.notes}
                    </p>
                  )}

                  {/* Existing attachments */}
                  {a.attachments && a.attachments.length > 0 && (
                    <div className="rounded border border-white/10 bg-white/5 p-2">
                      <b className="text-sm">Attachments:</b>
                      <ul className="mt-1 list-disc pl-6">
                        {(a.attachments as Attachment[]).map((f) => (
                          <li key={f.fileUrl}>
                            <a
                              href={f.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-300 hover:underline"
                            >
                              {f.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 space-y-4">
                  {/* Primary actions (Pending) */}
                  {a.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleApprove(a.id!)}
                        disabled={isBusy}
                        className={`rounded-lg px-3 py-1.5 text-sm text-white ${
                          isBusy
                            ? "bg-green-800/40 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {isBusy ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDecline(a.id!)}
                        disabled={isBusy}
                        className={`rounded-lg px-3 py-1.5 text-sm text-white ${
                          isBusy
                            ? "bg-red-800/40 cursor-not-allowed"
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                      >
                        {isBusy ? "Working…" : "Decline"}
                      </button>
                    </div>
                  )}

                  {/* Completion (Approved) */}
                  {a.status === "approved" && (
                    <div className="space-y-2">
                      <textarea
                        className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm"
                        placeholder="Enter visit notes / diagnosis…"
                        value={notes[a.id!] || ""}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [a.id!]: e.target.value,
                          }))
                        }
                      />
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleFileChange(a.id!, e)}
                        className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-white/20 file:px-3 file:py-1 file:text-white hover:file:bg-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => void handleComplete(a.id!)}
                        disabled={isBusy}
                        className={`rounded-lg px-3 py-1.5 text-sm text-white ${
                          isBusy
                            ? "bg-blue-800/40 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {isBusy ? "Completing…" : "Mark as Completed"}
                      </button>
                    </div>
                  )}

                  {/* Open AI Tools */}
                  <div>
                    <Link
                      href={`/doctor/appointments/${a.id}`}
                      className="inline-block rounded bg-white text-black px-3 py-2 hover:bg-gray-200"
                    >
                      Open / AI Tools →
                    </Link>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
