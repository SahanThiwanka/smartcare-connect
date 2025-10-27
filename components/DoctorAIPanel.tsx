// ./components/DoctorAIPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { aiSoapFromNotes, aiSummarizeAppointment } from "@/lib/aiClient";

type Mode = "Live" | "Simulated";

function isSimulated(text: string) {
  return text.trim().startsWith("[SIMULATED]");
}
function stripSimulated(text: string) {
  return isSimulated(text)
    ? text.replace(/^\[SIMULATED\]\s*/i, "").trim()
    : text;
}
function toMode(text: string): Mode {
  return isSimulated(text) ? "Simulated" : "Live";
}
function parseErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    return (e as { message?: string }).message || "Something went wrong.";
  }
  return "Something went wrong.";
}

export default function DoctorAIPanel({
  appointmentId,
  initialNotes,
}: {
  appointmentId?: string; // ← allow undefined so we can guard safely
  initialNotes?: string;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<null | "summary" | "soap">(null);

  const [summary, setSummary] = useState("");
  const [summaryMode, setSummaryMode] = useState<Mode>("Live");

  const [notes, setNotes] = useState(initialNotes ?? "");
  const [soap, setSoap] = useState("");
  const [soapMode, setSoapMode] = useState<Mode>("Live");

  const [localErr, setLocalErr] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auth bootstrap (anon)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anonymous sign-in failed:", e);
        } finally {
          setReady(true);
        }
        return;
      }
      setReady(true);
    });
    return () => unsub();
  }, []);

  // autoscroll on new text
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [summary, soap]);

  // keep local error clean when appointmentId becomes available
  useEffect(() => {
    if (appointmentId) setLocalErr(null);
  }, [appointmentId]);

  async function handleSummary() {
    // ✅ extra guard so we never call the function with a blank id
    if (!ready || !!busy) return;
    if (!appointmentId || !appointmentId.trim()) {
      setLocalErr("No appointment selected. Open an appointment to summarize.");
      return;
    }

    setBusy("summary");
    try {
      const out = await aiSummarizeAppointment(appointmentId);
      setSummaryMode(toMode(out));
      setSummary(stripSimulated(out));
    } catch (e) {
      const msg = parseErr(e);
      const fallback =
        msg.includes("quota") || msg.includes("resource-exhausted")
          ? "Our AI is temporarily limited. Please try again shortly."
          : msg;
      setSummaryMode("Simulated");
      setSummary(fallback);
    } finally {
      setBusy(null);
    }
  }

  async function handleSOAP() {
    if (!ready || !!busy || !notes.trim()) return;
    setBusy("soap");
    try {
      const out = await aiSoapFromNotes(notes);
      setSoapMode(toMode(out));
      setSoap(stripSimulated(out));
    } catch (e) {
      const msg = parseErr(e);
      const fallback =
        msg.includes("quota") || msg.includes("resource-exhausted")
          ? "Our AI is temporarily limited. Please try again shortly."
          : msg;
      setSoapMode("Simulated");
      setSoap(fallback);
    } finally {
      setBusy(null);
    }
  }

  const noAppt = !appointmentId || !appointmentId.trim();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg">Doctor AI Tools</h3>
          {/* tiny badge to show which appointment we’re acting on */}
          <span
            className={`text-[10px] px-2 py-0.5 rounded ${
              noAppt ? "bg-red-200 text-red-900" : "bg-sky-200 text-sky-900"
            }`}
            title={
              noAppt
                ? "Open an appointment detail page to enable summarization."
                : `Appointment: ${appointmentId}`
            }
          >
            {noAppt ? "No Appointment" : `ID: ${appointmentId}`}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            ready ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
          }`}
          title={ready ? "Signed in (anonymous) and ready" : "Connecting…"}
        >
          {ready ? "Ready" : "Connecting…"}
        </span>
      </div>

      {/* Inline local error (e.g., missing appointmentId) */}
      {localErr && (
        <div className="text-xs rounded border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2">
          {localErr}
        </div>
      )}

      {/* Appointment Summary */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSummary}
            disabled={!ready || !!busy || noAppt}
            className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
            title={noAppt ? "Open an appointment first" : "Summarize appointment"}
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
              title={
                summaryMode === "Simulated"
                  ? "Simulated fallback"
                  : "Live (OpenAI/Groq)"
              }
            >
              {summaryMode}
            </span>
          )}
        </div>
        {summary && (
          <div
            ref={scrollerRef}
            className="max-h-56 overflow-y-auto border rounded p-3 bg-gray-50 text-black"
          >
            <pre className="whitespace-pre-wrap text-sm">{summary}</pre>
          </div>
        )}
      </div>

      {/* SOAP */}
      <div className="space-y-2">
        <textarea
          className="w-full rounded border p-2 min-h-32"
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
              title={
                soapMode === "Simulated"
                  ? "Simulated fallback"
                  : "Live (OpenAI/Groq)"
              }
            >
              {soapMode}
            </span>
          )}
        </div>
        {soap && (
          <div className="max-h-72 overflow-y-auto border rounded p-3 bg-gray-50 text-black">
            <pre className="whitespace-pre-wrap text-sm">{soap}</pre>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500">
        AI outputs are for documentation assistance and not a substitute for clinical
        judgment.
      </p>
    </div>
  );
}
