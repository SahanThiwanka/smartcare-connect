// ./app/(dashboard)/admin/doctors/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { getPendingDoctors, approveDoctor, rejectDoctor } from "@/lib/admin";
import type { DoctorInfo } from "@/lib/doctors";
import { Loader2, Search, Check, X, MailCheck, RefreshCw } from "lucide-react";

// ——— UI helpers ———
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-md">
    {children}
  </div>
);

export default function AdminDoctorsPage() {
  const [pending, setPending] = useState<DoctorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [internalQuery, setInternalQuery] = useState(""); // debounced
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ——— fetcher ———
  const loadPending = async () => {
    setLoading(true);
    setError(null);
    try {
      // If your getPendingDoctors supports a search param, you could pass internalQuery.
      // For now, fetch all and client-filter below.
      const docs = await getPendingDoctors();
      setPending(docs);
    } catch (err) {
      console.error("Failed to load pending doctors:", err);
      setError("Failed to load pending doctors. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // initial
  useEffect(() => {
    void loadPending();
  }, []);

  // debounce on typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setInternalQuery(search);
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // refetch whenever internal (debounced) query changes
  useEffect(() => {
    void loadPending();
  }, [internalQuery]);

  // client-side safety filter in case backend ignores search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter((d) => {
      const name = (d.fullName || d.name || "").toLowerCase();
      const email = (d.email || "").toLowerCase();
      const spec = (d.specialty || "").toLowerCase();
      const qual = (d.qualification || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        spec.includes(q) ||
        qual.includes(q)
      );
    });
  }, [pending, search]);

  // actions
  const handleApprove = async (doc: DoctorInfo) => {
    if (!confirm(`Approve ${doc.fullName || doc.name || "this doctor"}?`))
      return;
    setProcessingUid(doc.uid);
    setError(null);
    try {
      await approveDoctor(doc.uid);

      // notify via API route
      await fetch("/api/notify-doctor-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: doc.email,
          name: doc.fullName || doc.name || "Doctor",
        }),
      });

      // local toast
      alert(`✅ Approved & notified: ${doc.fullName || doc.name || doc.email}`);

      // refresh
      await loadPending();
    } catch (err) {
      console.error("Approve failed:", err);
      setError("Approve failed. Check console for details.");
    } finally {
      setProcessingUid(null);
    }
  };

  const handleReject = async (uid: string) => {
    if (!confirm("Reject this doctor?")) return;
    setProcessingUid(uid);
    setError(null);
    try {
      await rejectDoctor(uid);
      await loadPending();
    } catch (err) {
      console.error("Reject failed:", err);
      setError("Reject failed. Check console for details.");
    } finally {
      setProcessingUid(null);
    }
  };

  const forceSearch = async () => {
    // bypass debounce and fetch immediately
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInternalQuery(search);
    await loadPending();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white py-8 px-6">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold"
          >
            Pending Doctor Approvals
          </motion.h1>

          {/* Search bar */}
          <Card>
            <div className="flex items-center gap-2 px-3 py-2">
              <Search className="h-5 w-5 text-white/70" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void forceSearch();
                }}
                placeholder="Search by name, email, specialty, qualification…"
                className="w-64 bg-transparent placeholder:text-white/50 focus:outline-none"
              />
              <button
                onClick={() => setSearch("")}
                className="ml-2 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
              >
                Clear
              </button>
              <button
                onClick={forceSearch}
                className="ml-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" /> Search
              </button>
            </div>
          </Card>
        </div>

        {/* Error bar */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="popLayout">
          {loading ? (
            // Skeletons
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={`sk-${i}`}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex gap-4">
                    <div className="h-20 w-20 animate-pulse rounded-full bg-white/10" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
                      <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
                      <div className="h-3 w-64 animate-pulse rounded bg-white/10" />
                      <div className="h-3 w-48 animate-pulse rounded bg-white/10" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-white/60"
            >
              No pending doctors found.
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid gap-5 md:grid-cols-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {filtered.map((doc) => {
                const name = doc.fullName || doc.name || "Unnamed Doctor";
                return (
                  <motion.div
                    key={doc.uid}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <Card>
                      <div className="p-5">
                        {/* Top row */}
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <div className="shrink-0">
                            {doc.photoURL ? (
                              <Image
                                src={doc.photoURL}
                                alt={name}
                                width={96}
                                height={96}
                                className="h-24 w-24 rounded-full border border-white/10 object-cover"
                              />
                            ) : (
                              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/10 text-3xl">
                                👨‍⚕️
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold">{name}</h3>
                              <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-xs text-white/80">
                                {doc.specialty || "—"}
                              </span>
                            </div>

                            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-white/80 sm:grid-cols-2">
                              <div>
                                <span className="text-white/50">Email:</span>{" "}
                                {doc.email || "—"}
                              </div>
                              <div>
                                <span className="text-white/50">Phone:</span>{" "}
                                {doc.phone || "—"}
                              </div>
                              <div>
                                <span className="text-white/50">
                                  Qualification:
                                </span>{" "}
                                {doc.qualification || "—"}
                              </div>
                              <div>
                                <span className="text-white/50">
                                  Experience:
                                </span>{" "}
                                {doc.experienceYears
                                  ? `${doc.experienceYears} years`
                                  : "—"}
                              </div>
                              <div className="sm:col-span-2">
                                <span className="text-white/50">Clinic:</span>{" "}
                                {doc.clinicAddress || "—"}
                              </div>
                              <div>
                                <span className="text-white/50">Fee:</span>{" "}
                                {doc.consultationFee || "—"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                          <button
                            onClick={() => void handleApprove(doc)}
                            disabled={processingUid === doc.uid}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 font-medium ${
                              processingUid === doc.uid
                                ? "bg-white/10 text-white/50"
                                : "bg-emerald-500 text-black hover:bg-emerald-400"
                            }`}
                            title="Approve and send email"
                          >
                            {processingUid === doc.uid ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            Approve
                            <MailCheck className="ml-1 h-4 w-4" />
                          </button>

                          <button
                            onClick={() => void handleReject(doc.uid)}
                            disabled={processingUid === doc.uid}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 font-medium ${
                              processingUid === doc.uid
                                ? "bg-white/10 text-white/50"
                                : "bg-red-500 text-white hover:bg-red-400"
                            }`}
                            title="Reject"
                          >
                            {processingUid === doc.uid ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                            Reject
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
