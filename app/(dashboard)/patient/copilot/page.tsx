"use client";

import { useEffect, useRef, useState } from "react";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { aiCareChat } from "@/lib/aiClient";

type Mode = "Simulated" | "Live";
type Msg = { from: "user" | "ai"; text: string; mode?: Mode };

function isSimulated(text: string) {
  return text.trim().startsWith("[SIMULATED]");
}
function stripSimulated(text: string) {
  return isSimulated(text) ? text.replace(/^\[SIMULATED\]\s*/i, "").trim() : text;
}
function detectMode(text: string): Mode {
  return isSimulated(text) ? "Simulated" : "Live";
}
function parseErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    return (e.message as string) || "Something went wrong.";
  }
  return "Something went wrong.";
}

export default function PatientCopilotPage() {
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs, loading]);

  async function send() {
    const q = input.trim();
    if (!q || !ready || loading) return;

    setMsgs((m) => [...m, { from: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const reply = await aiCareChat(q);
      const mode = detectMode(reply);
      const neat = stripSimulated(reply);
      setMsgs((m) => [...m, { from: "ai", text: neat, mode }]);
    } catch (e) {
      const err = parseErr(e);
      setMsgs((m) => [
        ...m,
        {
          from: "ai",
          text:
            err.includes("quota") || err.includes("resource-exhausted")
              ? "Our AI is temporarily limited. Please try again shortly."
              : err,
          mode: "Simulated",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onEnterSend(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Care Copilot</h1>
        <span
          className={`text-xs px-2 py-1 rounded ${
            ready ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
          }`}
          title={ready ? "Signed in (anonymous) and ready" : "Connecting…"}
        >
          {ready ? "Ready" : "Connecting…"}
        </span>
      </header>

      <div
        ref={scrollerRef}
        className="h-[60vh] border rounded p-3 overflow-y-auto bg-black text-white"
      >
        {msgs.map((m, i) => (
          <div key={i} className={`my-2 ${m.from === "user" ? "text-right" : ""}`}>
            <div
              className={`inline-block max-w-[85%] px-3 py-2 rounded whitespace-pre-wrap ${
                m.from === "user" ? "bg-blue-600" : "bg-gray-700"
              }`}
            >
              {m.text}
              {m.from === "ai" && (
                <div className="mt-2">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      m.mode === "Simulated"
                        ? "bg-yellow-200 text-yellow-900"
                        : "bg-emerald-200 text-emerald-900"
                    }`}
                    title={
                      m.mode === "Simulated"
                        ? "Simulated response (no paid API)"
                        : "Live model response (OpenAI/Groq)"
                    }
                  >
                    {m.mode || "Live"}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-300 italic mt-2">Thinking…</div>}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onEnterSend}
          placeholder="Describe symptoms, ask a question..."
          className="flex-1 border rounded p-2"
          disabled={!ready || loading}
        />
        <button
          type="button"
          onClick={send}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={!ready || loading || !input.trim()}
        >
          Send
        </button>
      </div>

      <p className="text-xs text-gray-500">
        This assistant provides general information and is not a substitute for professional
        care. If symptoms are severe or worsening, seek immediate medical help.
      </p>
    </div>
  );
}
