"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getDoctors,
  getPatients,
  getBlockedUsers,
  approveDoctor,
  setUserBlocked,
  removeUser,
  BaseUser,
} from "@/lib/adminUsers";
import Link from "next/link";

type Tab = "doctors" | "patients" | "blocked";

export default function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>("doctors");
  const [doctors, setDoctors] = useState<BaseUser[]>([]);
  const [patients, setPatients] = useState<BaseUser[]>([]);
  const [blocked, setBlocked] = useState<BaseUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [detail, setDetail] = useState<BaseUser | null>(null); // drawer/modal

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

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin · User Management</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
          >
            ← Back to Admin
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["doctors", "patients", "blocked"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded border text-sm ${
              tab === t ? "bg-black text-white" : "hover:bg-gray-50"
            }`}
          >
            {t === "doctors" && "Doctors"}
            {t === "patients" && "Patients"}
            {t === "blocked" && "Blocked"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === "doctors"
              ? "Search doctors by name, email, specialty…"
              : tab === "patients"
              ? "Search patients by name or email…"
              : "Search blocked users…"
          }
          className="w-full max-w-xl rounded border p-2"
        />
        <button
          onClick={() => setSearch("")}
          className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {/* List */}
      <div className="rounded border bg-black">
        <div className="grid grid-cols-12 gap-2 border-b bg-gray-500 p-3 text-sm font-semibold">
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">
            {tab === "doctors" ? "Specialty" : "Phone"}
          </div>
          <div className="col-span-1">Role</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading && <div className="p-4 text-sm">Loading…</div>}

        {!loading && list.length === 0 && (
          <div className="p-4 text-sm text-gray-500">No results.</div>
        )}

        {!loading &&
          list.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-12 gap-2 border-b p-3 text-sm"
            >
              <div className="col-span-4">
                <div className="font-medium">{u.fullName ?? "—"}</div>
                {u.role === "doctor" && (
                  <div className="text-xs text-gray-500">
                    {u.qualifications ?? u.qualification ?? ""}
                  </div>
                )}
              </div>
              <div className="col-span-3 break-all">{u.email}</div>
              <div className="col-span-2">
                {u.role === "doctor" ? u.specialty ?? "—" : u.phone ?? "—"}
              </div>
              <div className="col-span-1 capitalize">{u.role}</div>

              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setDetail(u)}
                  className="px-2 py-1 rounded border hover:bg-gray-50"
                  title="View details"
                >
                  View
                </button>

                {u.role === "doctor" && u.approved !== true && !u.blocked && (
                  <button
                    onClick={() => void handleApprove(u)}
                    className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                    title="Approve doctor"
                  >
                    Approve
                  </button>
                )}

                {!u.blocked ? (
                  <button
                    onClick={() => void handleBlock(u, true)}
                    className="px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
                    title="Block user"
                  >
                    Block
                  </button>
                ) : (
                  <button
                    onClick={() => void handleBlock(u, false)}
                    className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                    title="Unblock user"
                  >
                    Unblock
                  </button>
                )}

                <button
                  onClick={() => void handleRemove(u)}
                  className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                  title="Remove user"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Detail drawer / modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded bg-black p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {detail.fullName ?? "User"} · {detail.role}
              </h3>
              <button
                onClick={() => setDetail(null)}
                className="text-red-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Email</div>
                <div className="font-medium break-all">{detail.email}</div>
              </div>
              <div>
                <div className="text-gray-500">Phone</div>
                <div className="font-medium">{detail.phone ?? "—"}</div>
              </div>

              <div>
                <div className="text-gray-500">Status</div>
                <div className="font-medium">
                  {detail.blocked ? "Blocked" : "Active"}
                  {detail.role === "doctor" &&
                    ` • ${detail.approved ? "Approved" : "Pending approval"}`}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Created</div>
                <div className="font-medium">
                  {detail.createdAt
                    ? new Date(detail.createdAt).toLocaleString()
                    : "—"}
                </div>
              </div>

              {detail.role === "doctor" && (
                <>
                  <div>
                    <div className="text-gray-500">Specialty</div>
                    <div className="font-medium">{detail.specialty ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Qualifications</div>
                    <div className="font-medium">
                      {detail.qualifications ?? detail.qualification ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Experience (years)</div>
                    <div className="font-medium">
                      {detail.experienceYears ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">License</div>
                    <div className="font-medium">
                      {detail.licenseNumber ?? "—"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-500">Clinic Address</div>
                    <div className="font-medium">
                      {detail.clinicAddress ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Consultation Fee</div>
                    <div className="font-medium">
                      {detail.consultationFee ?? "—"}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              {detail.role === "doctor" &&
                detail.approved !== true &&
                !detail.blocked && (
                  <button
                    onClick={() => void handleApprove(detail)}
                    className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    Approve
                  </button>
                )}
              {!detail.blocked ? (
                <button
                  onClick={() => void handleBlock(detail, true)}
                  className="px-3 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
                >
                  Block
                </button>
              ) : (
                <button
                  onClick={() => void handleBlock(detail, false)}
                  className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Unblock
                </button>
              )}
              <button
                onClick={() => void handleRemove(detail)}
                className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Remove
              </button>
              <button
                onClick={() => setDetail(null)}
                className="px-3 py-2 rounded border hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
