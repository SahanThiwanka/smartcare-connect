"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  searchCaregiversByEmailPrefix,
  sendCaregiverRequest,
  getUser,
  UserLite,
} from "@/lib/caregivers";
import { db } from "@/lib/firebase";
import {
  doc,
  updateDoc,
  arrayRemove,
  deleteDoc,
  getDoc,
} from "firebase/firestore";

export default function PatientCaregiverAccessPage() {
  const { user } = useAuth();
  const [me, setMe] = useState<UserLite | null>(null);

  // Search & invite
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Current caregivers (detailed profiles, not just ids)
  const [cgProfiles, setCgProfiles] = useState<Record<string, UserLite>>({});
  const [revokeBusy, setRevokeBusy] = useState<string | null>(null);

  const [msg, setMsg] = useState<string | null>(null);

  // Load my (patient) doc
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const u = await getUser(user.uid);
        if (mounted) setMe(u ?? null);
      } catch {
        if (mounted) setMe(null);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const myCaregiverIds = useMemo(() => me?.caregivers || [], [me]);

  // Fetch profile details for all current caregiver ids
  useEffect(() => {
    let mounted = true;
    if (!myCaregiverIds.length) {
      setCgProfiles({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        myCaregiverIds.map(async (id) => {
          try {
            // Prefer caregivers collection user doc if you store extra info; fallback to /users
            const u = await getUser(id);
            return [id, u ?? { uid: id }] as const;
          } catch {
            return [id, { uid: id }] as const;
          }
        })
      );
      if (mounted) {
        setCgProfiles(Object.fromEntries(entries));
      }
    })();
    return () => { mounted = false; };
  }, [myCaregiverIds]);

  // Search caregivers
  const doSearch = useCallback(async () => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await searchCaregiversByEmailPrefix(search.trim());
      setResults(rows);
    } finally {
      setSearching(false);
    }
  }, [search]);

  // Enter to search
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void doSearch();
  }

  // Invite caregiver
  async function invite(cg: UserLite) {
    if (!user) return;
    setBusyId(cg.uid);
    setMsg(null);
    try {
      await sendCaregiverRequest(user.uid, cg.uid);
      setMsg(`Request sent to ${cg.fullName || cg.email || cg.uid}.`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to send request");
    } finally {
      setBusyId(null);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  // Revoke caregiver access
  async function revoke(cgUid: string) {
    if (!user) return;
    if (!confirm("Revoke this caregiver’s access?")) return;
    setRevokeBusy(cgUid);
    setMsg(null);

    try {
      // Remove from patient's caregivers array
      await updateDoc(doc(db, "users", user.uid), {
        caregivers: arrayRemove(cgUid),
      });

      // Best-effort caregiver-side cleanup (ignore errors)
      try {
        await deleteDoc(doc(db, "caregivers", cgUid, "patients", user.uid));
      } catch {}
      try {
        await deleteDoc(doc(db, "caregivers", cgUid, "requests", user.uid));
      } catch {}

      // Locally update UI
      setMe((prev) =>
        prev
          ? { ...prev, caregivers: (prev.caregivers || []).filter((id) => id !== cgUid) }
          : prev
      );
      setCgProfiles((prev) => {
        const n = { ...prev };
        delete n[cgUid];
        return n;
      });

      setMsg("Access revoked.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to revoke access");
    } finally {
      setRevokeBusy(null);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  const caregivers = useMemo(() => {
    return myCaregiverIds
      .map((id) => cgProfiles[id] || { uid: id })
      // sort by name then email for nicer UI
      .sort((a, b) => {
        const an = (a.fullName || "").toLowerCase();
        const bn = (b.fullName || "").toLowerCase();
        if (an && bn && an !== bn) return an.localeCompare(bn);
        return (a.email || "").toLowerCase().localeCompare((b.email || "").toLowerCase());
      });
  }, [myCaregiverIds, cgProfiles]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <motion.h1 initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">
          Caregiver Access
        </motion.h1>

        {/* Search / Invite */}
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
          <h2 className="font-semibold mb-2">Find a Caregiver</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2"
              placeholder="Search by caregiver email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            <button
              onClick={() => void doSearch()}
              className="rounded bg-blue-600 px-4 py-2 font-medium hover:bg-blue-700"
              disabled={searching}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-4 space-y-2">
              {results.map((cg) => (
                <div
                  key={cg.uid}
                  className="flex items-center justify-between rounded border border-white/10 bg-black/30 p-3"
                >
                  <div>
                    <div className="font-medium">{cg.fullName || "Unnamed"}</div>
                    <div className="text-sm text-white/70">{cg.email || "—"}</div>
                  </div>
                  <button
                    onClick={() => void invite(cg)}
                    disabled={busyId === cg.uid}
                    className="rounded bg-green-600 px-3 py-1.5 text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {busyId === cg.uid ? "Sending…" : "Send Request"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {msg && <p className="mt-3 text-sm text-white/80">{msg}</p>}
        </div>

        {/* Current caregivers */}
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
          <h2 className="font-semibold mb-2">Current Caregivers</h2>

          {caregivers.length === 0 ? (
            <p className="text-white/70 text-sm">
              No caregivers linked yet. Search by email above and send a request.
            </p>
          ) : (
            <div className="space-y-2">
              {caregivers.map((cg) => (
                <div
                  key={cg.uid}
                  className="flex items-center justify-between rounded border border-white/10 bg-black/30 p-3"
                >
                  <div>
                    <div className="font-medium">
                      {cg.fullName || "Unnamed"}{" "}
                      <span className="text-xs text-white/50">(caregiver)</span>
                    </div>
                    <div className="text-sm text-white/70">{cg.email || cg.uid}</div>
                  </div>
                  <button
                    onClick={() => void revoke(cg.uid)}
                    disabled={revokeBusy === cg.uid}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm hover:bg-red-700 disabled:opacity-50"
                    title="Revoke this caregiver’s access"
                  >
                    {revokeBusy === cg.uid ? "Revoking…" : "Revoke Access"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* (Optional) Gentle reminder */}
        <p className="text-xs text-white/50">
          Tip: After access is granted, caregivers can add daily measures to your account and their
          entries will be labeled as <b>Caregiver</b> in your Daily Measures list.
        </p>
      </div>
    </div>
  );
}
