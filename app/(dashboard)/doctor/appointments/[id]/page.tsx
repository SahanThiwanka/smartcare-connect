// app/(dashboard)/doctor/appointments/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  approveAppointment,
  declineAppointment,
  completeAppointment,
  type Appointment,
} from "@/lib/appointments";
import { db, storage, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { aiSoapFromNotes, aiSummarizeAppointment } from "@/lib/aiClient";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

// ---------- tiny utils ----------
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

// Firestore user doc shape (for typing pSnap.data())
type FirestoreUser = {
  fullName?: string;
  email?: string;
  phone?: string;
};

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

// ---------- lightweight embedded AI panel ----------
type Mode = "Live" | "Simulated";
const isSim = (t: string) => t.trim().startsWith("[SIMULATED]");
const clean = (t: string) => (isSim(t) ? t.replace(/^\[SIMULATED\]\s*/i, "").trim() : t);
const toMode = (t: string): Mode => (isSim(t) ? "Simulated" : "Live");

function AIPanel({
  appointmentId,
  initialNotes,
  onInsert,
  onAppend,
}: {
  appointmentId: string;
  initialNotes?: string;
  onInsert: (text: string) => void;
  onAppend: (text: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<null | "summary" | "soap">(null);
  const [summary, setSummary] = useState("");
  const [summaryMode, setSummaryMode] = useState<Mode>("Live");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [soap, setSoap] = useState("");
  const [soapMode, setSoapMode] = useState<Mode>("Live");
  const scrollRef = useRef<HTMLDivElement>(null);

  // ensure a user exists for callable functions; if doctor is already authed this is a no-op
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) await signInAnonymously(auth);
      setReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [summary, soap]);

  async function handleSummary() {
    if (!ready || busy) return;
    setBusy("summary");
    try {
      const out = await aiSummarizeAppointment(appointmentId);
      setSummaryMode(toMode(out));
      setSummary(clean(out));
    } catch (e: unknown) {
      setSummaryMode("Simulated");
      setSummary(e instanceof Error ? e.message : "Could not summarize this appointment.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSOAP() {
    if (!ready || busy || !notes.trim()) return;
    setBusy("soap");
    try {
      const out = await aiSoapFromNotes(notes);
      setSoapMode(toMode(out));
      setSoap(clean(out));
    } catch (e: unknown) {
      setSoapMode("Simulated");
      setSoap(e instanceof Error ? e.message : "Could not format notes.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">AI Assistant</h4>
        <span
          className={`text-[10px] px-2 py-0.5 rounded ${
            ready ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {ready ? "Ready" : "Connecting…"}
        </span>
      </div>

      {/* Summarize */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSummary}
            disabled={!ready || !!busy}
            className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
          >
            {busy === "summary" ? "Summarizing…" : "Summarize Appointment"}
          </button>
          {summary && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                summaryMode === "Simulated"
                  ? "bg-yellow-200 text-yellow-900"
                  : "bg-emerald-200 text-emerald-900"
              }`}
              title={summaryMode === "Simulated" ? "Simulated fallback" : "Live (OpenAI/Groq)"}
            >
              {summaryMode}
            </span>
          )}
        </div>

        {summary && (
          <>
            <div
              ref={scrollRef}
              className="max-h-40 overflow-y-auto border rounded p-3 bg-gray-50 text-black"
            >
              <pre className="whitespace-pre-wrap text-sm">{summary}</pre>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onInsert(summary)}
                className="px-2 py-1 rounded bg-black text-white text-xs"
              >
                Insert → Notes
              </button>
              <button
                type="button"
                onClick={() => onAppend("\n" + summary)}
                className="px-2 py-1 rounded bg-black/60 text-white text-xs"
              >
                Append
              </button>
            </div>
          </>
        )}
      </div>

      {/* SOAP */}
      <div className="space-y-2">
        <textarea
          className="w-full rounded border border-white/10 bg-black/30 p-2 min-h-24 text-white"
          placeholder="Paste raw visit notes here…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSOAP}
            disabled={!ready || !!busy || !notes.trim()}
            className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
          >
            {busy === "soap" ? "Formatting…" : "Format to SOAP"}
          </button>
          {soap && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                soapMode === "Simulated"
                  ? "bg-yellow-200 text-yellow-900"
                  : "bg-emerald-200 text-emerald-900"
              }`}
              title={soapMode === "Simulated" ? "Simulated fallback" : "Live (OpenAI/Groq)"}
            >
              {soapMode}
            </span>
          )}
        </div>
        {soap && (
          <>
            <div className="max-h-56 overflow-y-auto border rounded p-3 bg-gray-50 text-black">
              <pre className="whitespace-pre-wrap text-sm">{soap}</pre>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onInsert(soap)}
                className="px-2 py-1 rounded bg-black text-white text-xs"
              >
                Insert SOAP → Notes
              </button>
              <button
                type="button"
                onClick={() => onAppend("\n" + soap)}
                className="px-2 py-1 rounded bg-black/60 text-white text-xs"
              >
                Append
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] text-white/60">
        AI assists documentation and is not a substitute for clinical judgment.
      </p>
    </div>
  );
}

// ---------- page component ----------
export default function DoctorAppointmentDetailPage() {
  const params = useParams<{ id: string }>(); // no Promise warning
  const router = useRouter();
  const { user } = useAuth();

  const appointmentId = useMemo(() => {
    const v = params?.id as unknown;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v[0];
    return "";
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  // fetch appointment + patient
  const load = useCallback(async () => {
    if (!user || !appointmentId) return;
    setLoading(true);
    setError(null);
    try {
      const aSnap = await getDoc(doc(db, "appointments", appointmentId));
      if (!aSnap.exists()) {
        setError("Appointment not found.");
        setAppointment(null);
        setPatient(null);
        return;
      }
      const a = { id: aSnap.id, ...aSnap.data() } as Appointment;
      setAppointment(a);
      setNotes(a.notes || "");

      // patient info
      const pSnap = await getDoc(doc(db, "users", a.patientId));
      if (pSnap.exists()) {
        const d = pSnap.data() as FirestoreUser;
        setPatient({
          id: pSnap.id,
          fullName: d.fullName ?? "Unknown",
          email: d.email ?? "-",
          phone: d.phone ?? "-",
        });
      } else {
        setPatient({
          id: a.patientId,
          fullName: "Unknown",
          email: "-",
          phone: "-",
        });
      }
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to load appointment.");
    } finally {
      setLoading(false);
    }
  }, [user, appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  // actions
  async function doApprove() {
    if (!appointment?.id) return;
    setBusy(true);
    try {
      await approveAppointment(appointment.id);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function doDecline() {
    if (!appointment?.id) return;
    if (!confirm("Decline this appointment?")) return;
    setBusy(true);
    try {
      await declineAppointment(appointment.id);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function doComplete() {
    if (!appointment?.id) return;
    if (!notes.trim()) {
      alert("Please add notes first.");
      return;
    }
    setBusy(true);
    try {
      // upload files if any
      let uploaded: Attachment[] = [];
      if (files.length) {
        const ups: Attachment[] = [];
        for (const f of files) {
          const path = `appointments/${appointment.id}/${Date.now()}-${f.name}`;
          const fref = ref(storage, path);
          await uploadBytes(fref, f);
          const url = await getDownloadURL(fref);
          ups.push({ fileName: f.name, fileUrl: url, storagePath: path, uploadedAt: Date.now() });
        }
        uploaded = ups;
      }

      // merge with existing attachments
      const existing = ((appointment.attachments as Attachment[]) || []) as Attachment[];
      const merged = [...existing, ...uploaded];

      await completeAppointment(appointment.id, notes);
      await updateDoc(doc(db, "appointments", appointment.id), {
        notes,
        attachments: merged,
      });
      await load();
      setFiles([]);
      alert("Marked as completed.");
    } finally {
      setBusy(false);
    }
  }

  // UI
  if (!appointmentId) {
    return (
      <div className="p-6 text-white">
        <p>Missing appointment id.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Appointment</h1>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm"
          >
            ← Back
          </button>
        </div>

        {loading && <p className="text-white/70">Loading…</p>}
        {error && <p className="text-red-300">{error}</p>}

        {appointment && patient && (
          <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            {/* LEFT: details + actions */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{patient.fullName}</h2>
                  <p className="text-sm text-white/70">
                    {patient.email} • {patient.phone}
                  </p>
                </div>
                <span
                  className={`inline-flex h-6 items-center rounded border px-2 text-xs ${badgeClasses(
                    appointment.status
                  )}`}
                >
                  {appointment.status}
                </span>
              </div>

              <div className="grid gap-2 text-sm">
                <p>
                  <span className="text-white/60">Date:</span>{" "}
                  <span className="font-medium">{fmtDate(appointment.date)}</span>
                </p>
                <p>
                  <span className="text-white/60">Reason:</span>{" "}
                  <span className="font-medium">{appointment.reason || "—"}</span>
                </p>
              </div>

              {/* existing notes (if completed) */}
              {appointment.status !== "approved" && appointment.notes && (
                <div className="rounded bg-white/5 p-3">
                  <b>Notes:</b>
                  <div className="mt-1 whitespace-pre-wrap text-sm">{appointment.notes}</div>
                </div>
              )}

              {/* existing attachments */}
              {appointment.attachments && (appointment.attachments as Attachment[]).length > 0 && (
                <div className="rounded border border-white/10 bg-white/5 p-3">
                  <b className="text-sm">Attachments:</b>
                  <ul className="mt-1 list-disc pl-6">
                    {(appointment.attachments as Attachment[]).map((f) => (
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

              {/* status actions */}
              {appointment.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void doApprove()}
                    disabled={busy}
                    className={`rounded-lg px-3 py-1.5 text-sm text-white ${
                      busy ? "bg-green-800/40 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {busy ? "Working…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void doDecline()}
                    disabled={busy}
                    className={`rounded-lg px-3 py-1.5 text-sm text-white ${
                      busy ? "bg-red-800/40 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {busy ? "Working…" : "Decline"}
                  </button>
                </div>
              )}

              {appointment.status === "approved" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-white/70">Visit Notes</label>
                    <textarea
                      className="w-full mt-1 rounded-lg border border-white/10 bg-black/30 p-2 text-sm"
                      placeholder="Enter visit notes / diagnosis…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/70">Attach Files</label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                      className="w-full mt-1 rounded-lg border border-white/10 bg-black/20 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-white/20 file:px-3 file:py-1 file:text-white hover:file:bg-white/30"
                    />
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => void doComplete()}
                      disabled={busy}
                      className={`rounded-lg px-3 py-1.5 text-sm text-white ${
                        busy ? "bg-blue-800/40 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {busy ? "Completing…" : "Mark as Completed"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT: AI panel */}
            <AIPanel
              appointmentId={appointment.id!}
              initialNotes={notes}
              onInsert={(text) => setNotes(text)}
              onAppend={(text) => setNotes((prev) => (prev || "") + text)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
