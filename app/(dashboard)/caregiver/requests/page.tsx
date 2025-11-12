"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getIncomingRequests,
  decideCaregiverRequest,
  getUser,
  type CaregiverRequest,
  type UserLite,
} from "@/lib/caregivers";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  Search,
  ExternalLink,
  ClipboardCheck,
  Clipboard,
  SortAsc,
  SortDesc,
} from "lucide-react";

/* ----------------------------- Types & helpers ---------------------------- */

type Row = CaregiverRequest & { patient?: UserLite | null };

function fmtWhen(ts?: any) {
  if (!ts) return "-";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "-";
  }
}

function relTime(ts?: any) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const delta = Date.now() - d.getTime();
    const abs = Math.abs(delta);
    const m = Math.floor(abs / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

function useSelection<T extends { id?: string }>(rows: T[]) {
  const [set, setSet] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // reset selection when rows change (preserve only visible IDs)
    const next: Record<string, boolean> = {};
    rows.forEach((r) => {
      if (r.id && set[r.id]) next[r.id] = true;
    });
    setSet(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.id).join(",")]);
  const toggle = (id: string) => setSet((s) => ({ ...s, [id]: !s[id] }));
  const clear = () => setSet({});
  const all = rows.every((r) => r.id && set[r.id]);
  const any = rows.some((r) => r.id && set[r.id]);
  const setAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    if (on) rows.forEach((r) => r.id && (next[r.id] = true));
    setSet(next);
  };
  const selectedIds = rows
    .filter((r) => r.id && set[r.id])
    .map((r) => r.id!) as string[];
  return { selectedIds, all, any, toggle, setAll, clear, map: set };
}

export default function CaregiverRequestsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null); // null = loading
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");

  const selection = useSelection(rows || []);
  const loading = rows === null;

  // fetch with patient details enriched
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setRows(null);
        const list = await getIncomingRequests(user.uid);
        const withPatients: Row[] = await Promise.all(
          list.map(async (r) => {
            const patient = await getUser(r.patientId);
            return { ...r, patient };
          })
        );
        setRows(withPatients);
      } catch (e) {
        console.error(e);
        setRows([]);
      }
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    const base = s
      ? rows.filter((r) => {
          const hay = [
            r.patient?.fullName || "",
            r.patient?.email || "",
            r.patientId || "",
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(s);
        })
      : rows.slice();

    base.sort((a, b) => {
      const da =
        a.createdAt?.toMillis?.() ?? a.createdAt?.toDate?.()?.getTime?.() ?? 0;
      const db =
        b.createdAt?.toMillis?.() ?? b.createdAt?.toDate?.()?.getTime?.() ?? 0;
      return sort === "new" ? db - da : da - db;
    });
    return base;
  }, [rows, q, sort]);

  async function decideSingle(id: string, accept: boolean) {
    if (!user) return;
    setBusy(id);
    try {
      await decideCaregiverRequest(id, user.uid, accept);
      setRows((prev) => (prev || []).filter((r) => r.id !== id));
      setMsg(accept ? "✅ Accepted and linked." : "🚫 Rejected.");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to process the request.");
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 3500);
    }
  }

  async function decideBulk(accept: boolean) {
    if (!user) return;
    const ids = selection.selectedIds;
    if (ids.length === 0) return;
    const verb = accept ? "accept" : "reject";
    const ok = confirm(
      `Are you sure you want to ${verb} ${ids.length} request(s)?`
    );
    if (!ok) return;

    setBusy("bulk");
    try {
      for (const id of ids) {
        await decideCaregiverRequest(id, user.uid, accept);
      }
      setRows((prev) => (prev || []).filter((r) => !ids.includes(r.id!)));
      selection.clear();
      setMsg(
        accept
          ? "✅ Accepted selected requests."
          : "🚫 Rejected selected requests."
      );
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Failed to process some requests.");
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 3500);
    }
  }

  function copy(text?: string | null) {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold"
          >
            Caregiver Requests
          </motion.h1>
          <div className="text-sm text-white/70">
            {loading ? "Loading…" : `${filtered.length} pending`}
          </div>
        </div>

        {/* Controls bar */}
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/50" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by patient email or name…"
                  className="w-full rounded bg-black/40 border border-white/10 pl-8 pr-3 py-2 placeholder:text-white/50 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setSort((s) => (s === "new" ? "old" : "new"))}
                className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"
                title={sort === "new" ? "Newest first" : "Oldest first"}
              >
                {sort === "new" ? (
                  <SortDesc className="h-4 w-4" />
                ) : (
                  <SortAsc className="h-4 w-4" />
                )}
                {sort === "new" ? "Newest" : "Oldest"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-white/70 flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-blue-400"
                  checked={selection.all && filtered.length > 0}
                  onChange={(e) => selection.setAll(e.target.checked)}
                />
                Select all
              </label>

              <button
                onClick={() => void decideBulk(true)}
                disabled={!selection.any || busy === "bulk"}
                className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-2 text-sm hover:bg-green-500 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busy === "bulk" ? "Working…" : "Accept"}
              </button>
              <button
                onClick={() => void decideBulk(false)}
                disabled={!selection.any || busy === "bulk"}
                className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-2 text-sm hover:bg-red-500 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {busy === "bulk" ? "Working…" : "Reject"}
              </button>
            </div>
          </div>
        </div>

        {msg && (
          <div className="rounded-lg border border-white/10 bg-white/10 p-3 text-sm">
            {msg}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse h-16 rounded border border-white/10 bg-white/10"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-center text-white/70">
            No pending requests found.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const p = r.patient;
              const checked = !!(r.id && selection.map[r.id]);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded border border-white/10 bg-white/10 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      className="accent-blue-400"
                      checked={checked}
                      onChange={() => r.id && selection.toggle(r.id)}
                    />
                    {/* Avatar initials */}
                    <div className="h-9 w-9 rounded-full bg-blue-500/20 border border-blue-400/30 grid place-items-center text-blue-200 font-semibold">
                      {(p?.fullName || p?.email || r.patientId || "?")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {p?.fullName || p?.email || r.patientId}
                      </div>
                      <div className="text-xs text-white/60 flex items-center gap-2">
                        {p?.email ? (
                          <>
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate">{p.email}</span>
                            <button
                              onClick={() => copy(p.email)}
                              className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 hover:bg-white/10"
                              title="Copy email"
                            >
                              <Clipboard className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="italic">no email</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="text-right">
                      <div className="text-white/80">
                        {relTime(r.createdAt)}
                      </div>
                      <div className="text-white/50 text-xs">
                        {fmtWhen(r.createdAt)}
                      </div>
                    </div>

                    <a
                      href="/caregiver/patients"
                      className="hidden sm:inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                      title="Go to Patients"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Patients
                    </a>

                    <button
                      onClick={() => r.id && decideSingle(r.id, true)}
                      disabled={busy === r.id}
                      className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 hover:bg-green-500 disabled:opacity-50"
                    >
                      {busy === r.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Working…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Accept
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => r.id && decideSingle(r.id, false)}
                      disabled={busy === r.id}
                      className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 hover:bg-red-500 disabled:opacity-50"
                    >
                      {busy === r.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Working…
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" /> Reject
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
