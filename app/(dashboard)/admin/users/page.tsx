"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getDoctors,
  getPatients,
  getBlockedUsers,
  approveDoctor,
  setUserBlocked,
  removeUser,
  BaseUser,
} from "@/lib/adminUsers";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users2,
  Stethoscope,
  UserMinus,
  ShieldCheck,
  ShieldAlert,
  Ban,
  Check,
  X,
  Search,
  ChevronRight,
} from "lucide-react";

type Tab = "doctors" | "patients" | "blocked";

export default function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>("doctors");
  const [doctors, setDoctors] = useState<BaseUser[]>([]);
  const [patients, setPatients] = useState<BaseUser[]>([]);
  const [blocked, setBlocked] = useState<BaseUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<BaseUser | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [d, p, b] = await Promise.all([
        getDoctors(),
        getPatients(),
        getBlockedUsers(),
      ]);
      setDoctors(d);
      setPatients(p);
      setBlocked(b);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const src =
      tab === "doctors" ? doctors : tab === "patients" ? patients : blocked;
    if (!q) return src;
    return src.filter((u) => {
      const inName = (u.fullName ?? "").toLowerCase().includes(q);
      const inEmail = (u.email ?? "").toLowerCase().includes(q);
      const inSpec = (u.specialty ?? "").toLowerCase().includes(q);
      return inName || inEmail || inSpec;
    });
  }, [tab, search, doctors, patients, blocked]);

  async function handleApprove(u: BaseUser) {
    if (!confirm(`Approve Dr. ${u.fullName ?? u.email}?`)) return;
    await approveDoctor(u.uid);
    await load();
  }

  async function handleBlock(u: BaseUser, blockedFlag: boolean) {
    const action = blockedFlag ? "Block" : "Unblock";
    if (!confirm(`${action} ${u.fullName ?? u.email}?`)) return;
    await setUserBlocked(u.uid, blockedFlag);
    await load();
  }

  async function handleRemove(u: BaseUser) {
    if (
      !confirm(
        `Remove ${u.role} "${
          u.fullName ?? u.email
        }" from the system?\nThis deletes their user document.`
      )
    )
      return;
    await removeUser(u.uid);
    await load();
  }

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: Tab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <button
      onClick={() => setTab(id)}
      className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
        tab === id
          ? "text-white"
          : "text-white/60 hover:text-white hover:bg-white/5"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {tab === id && (
        <motion.span
          layoutId="pill"
          className="absolute inset-0 -z-10 rounded-xl bg-white/10"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
    </button>
  );

  const Chip = ({
    children,
    tone = "slate",
  }: {
    children: React.ReactNode;
    tone?: "slate" | "green" | "yellow" | "red" | "blue";
  }) => {
    const tones: Record<string, string> = {
      slate: "bg-white/10 text-white",
      green: "bg-emerald-500/15 text-emerald-300",
      yellow: "bg-amber-500/15 text-amber-300",
      red: "bg-rose-500/15 text-rose-300",
      blue: "bg-sky-500/15 text-sky-300",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${tones[tone]}`}
      >
        {children}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">User Management</h1>
          <p className="text-sm text-white/60">
            Approve doctors, manage patients, and control account access.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
        >
          Admin Home <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton id="doctors" label="Doctors" icon={Stethoscope} />
        <TabButton id="patients" label="Patients" icon={Users2} />
        <TabButton id="blocked" label="Blocked" icon={Ban} />
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "doctors"
                ? "Search doctors by name, email, or specialty…"
                : tab === "patients"
                ? "Search patients by name or email…"
                : "Search blocked users…"
            }
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
        </div>
        <button
          onClick={() => setSearch("")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          Clear
        </button>
      </div>

      {/* List header */}
      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="grid grid-cols-12 gap-2 border-b border-white/10 p-3 text-xs font-semibold uppercase tracking-wide text-white/60">
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">
            {tab === "doctors" ? "Specialty" : "Phone"}
          </div>
          <div className="col-span-1">Role</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Loading */}
        {loading && <div className="p-6 text-sm text-white/70">Loading…</div>}

        {/* Empty */}
        {!loading && list.length === 0 && (
          <div className="p-6 text-sm text-white/50">No results.</div>
        )}

        {/* Rows */}
        <AnimatePresence initial={false}>
          {!loading &&
            list.map((u) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="grid grid-cols-12 gap-2 border-t border-white/10 p-3 text-sm text-white"
              >
                <div className="col-span-4">
                  <div className="font-medium">
                    {u.fullName ?? "—"}{" "}
                    {u.role === "doctor" && (
                      <>
                        {" "}
                        {u.approved ? (
                          <Chip tone="green">
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            Approved
                          </Chip>
                        ) : (
                          <Chip tone="yellow">
                            <ShieldAlert className="mr-1 h-3 w-3" />
                            Pending
                          </Chip>
                        )}
                      </>
                    )}{" "}
                    {u.blocked && <Chip tone="red">Blocked</Chip>}
                  </div>
                  {u.role === "doctor" &&
                    (u.qualifications ?? u.qualification) && (
                      <div className="text-xs text-white/50">
                        {u.qualifications ?? u.qualification}
                      </div>
                    )}
                </div>

                <div className="col-span-3 break-all text-white/90">
                  {u.email}
                </div>

                <div className="col-span-2 text-white/80">
                  {u.role === "doctor" ? u.specialty ?? "—" : u.phone ?? "—"}
                </div>

                <div className="col-span-1 capitalize text-white/70">
                  {u.role}
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setDetail(u)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                    title="View details"
                  >
                    View
                  </button>

                  {u.role === "doctor" && u.approved !== true && !u.blocked && (
                    <button
                      onClick={() => void handleApprove(u)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700"
                      title="Approve doctor"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                  )}

                  {!u.blocked ? (
                    <button
                      onClick={() => void handleBlock(u, true)}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-white hover:bg-amber-600"
                      title="Block user"
                    >
                      <Ban className="h-4 w-4" />
                      Block
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleBlock(u, false)}
                      className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-white hover:bg-sky-700"
                      title="Unblock user"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Unblock
                    </button>
                  )}

                  <button
                    onClick={() => void handleRemove(u)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-white hover:bg-rose-700"
                    title="Remove user"
                  >
                    <UserMinus className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {detail && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-xl rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-5 text-white shadow-2xl backdrop-blur-md"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {detail.fullName ?? "User"} ·{" "}
                  <span className="capitalize">{detail.role}</span>
                </h3>
                <button
                  onClick={() => setDetail(null)}
                  className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-white/60">Email</div>
                  <div className="font-medium break-all">{detail.email}</div>
                </div>
                <div>
                  <div className="text-white/60">Phone</div>
                  <div className="font-medium">{detail.phone ?? "—"}</div>
                </div>

                <div>
                  <div className="text-white/60">Status</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={detail.blocked ? "red" : "green"}>
                      {detail.blocked ? "Blocked" : "Active"}
                    </Chip>
                    {detail.role === "doctor" && (
                      <Chip tone={detail.approved ? "green" : "yellow"}>
                        {detail.approved ? "Approved" : "Pending approval"}
                      </Chip>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-white/60">Created</div>
                  <div className="font-medium">
                    {detail.createdAt
                      ? new Date(detail.createdAt).toLocaleString()
                      : "—"}
                  </div>
                </div>

                {detail.role === "doctor" && (
                  <>
                    <div>
                      <div className="text-white/60">Specialty</div>
                      <div className="font-medium">
                        {detail.specialty ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60">Qualifications</div>
                      <div className="font-medium">
                        {detail.qualifications ?? detail.qualification ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60">Experience (years)</div>
                      <div className="font-medium">
                        {detail.experienceYears ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60">License</div>
                      <div className="font-medium">
                        {detail.licenseNumber ?? "—"}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-white/60">Clinic Address</div>
                      <div className="font-medium">
                        {detail.clinicAddress ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60">Consultation Fee</div>
                      <div className="font-medium">
                        {detail.consultationFee ?? "—"}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                {detail.role === "doctor" &&
                  detail.approved !== true &&
                  !detail.blocked && (
                    <button
                      onClick={() => void handleApprove(detail)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                  )}

                {!detail.blocked ? (
                  <button
                    onClick={() => void handleBlock(detail, true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-white hover:bg-amber-600"
                  >
                    <Ban className="h-4 w-4" />
                    Block
                  </button>
                ) : (
                  <button
                    onClick={() => void handleBlock(detail, false)}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-white hover:bg-sky-700"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Unblock
                  </button>
                )}

                <button
                  onClick={() => void handleRemove(detail)}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-white hover:bg-rose-700"
                >
                  <UserMinus className="h-4 w-4" />
                  Remove
                </button>

                <button
                  onClick={() => setDetail(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
