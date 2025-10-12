"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  getAppointmentsByDoctor,
  type Appointment,
} from "@/lib/appointments";

import { motion } from "framer-motion";
import CountUp from "react-countup";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

/* ------------------------------- Types ------------------------------- */

type FirestorePatient = {
  fullName?: string;
  name?: string;
  email?: string;
};

type AppointmentWithPatient = Appointment & {
  patientName?: string;
};

/* --------------------------- Date utilities -------------------------- */

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  // Make Monday=week start; change to 0 if you want Sunday
  const day = x.getDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // 0 for Mon, 6 for Sun
  x.setDate(x.getDate() - diff);
  return x;
}

function weekKey(d: Date) {
  // e.g. 2025-W41
  const firstJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor(
    (startOfDay(d).getTime() - startOfDay(firstJan).getTime()) / 86400000
  );
  const week = Math.floor((days + firstJan.getDay()) / 7) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatDateTime(isoOrMillis?: string | number) {
  if (!isoOrMillis) return "-";
  const t =
    typeof isoOrMillis === "number"
      ? new Date(isoOrMillis)
      : new Date(isoOrMillis);
  if (Number.isNaN(t.getTime())) return "-";
  return t.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatTime(isoOrMillis?: string | number) {
  if (!isoOrMillis) return "-";
  const t =
    typeof isoOrMillis === "number"
      ? new Date(isoOrMillis)
      : new Date(isoOrMillis);
  if (Number.isNaN(t.getTime())) return "-";
  return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ------------------------------ Component ---------------------------- */

export default function DoctorDashboardPage() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [doctorName, setDoctorName] = useState<string>("Doctor");

  // Fetch appointments and attach patient names
  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);

      // doctor display name
      try {
        const me = await getDoc(doc(db, "users", user.uid));
        if (me.exists()) {
          const data = me.data() as { fullName?: string; name?: string; email?: string };
          setDoctorName(data.fullName || data.name || data.email || "Doctor");
        }
      } catch {
        setDoctorName("Doctor");
      }

      const apps = await getAppointmentsByDoctor(user.uid);

      const withNames = await Promise.all(
        apps.map(async (a) => {
          try {
            const pSnap = await getDoc(doc(db, "users", a.patientId));
            if (pSnap.exists()) {
              const pd = pSnap.data() as FirestorePatient;
              return {
                ...a,
                patientName: pd.fullName || pd.name || a.patientId,
              };
            }
          } catch {
            /* ignore */
          }
          return { ...a, patientName: a.patientId };
        })
      );

      // sort newest first for recents
      withNames.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setAppointments(withNames);
      setLoading(false);
    })();
  }, [user]);

  /* ------------------------------ KPIs ------------------------------ */
  const stats = useMemo(() => {
    const pending = appointments.filter((a) => a.status === "pending").length;
    const approved = appointments.filter((a) => a.status === "approved").length;
    const completed = appointments.filter((a) => a.status === "completed").length;

    const uniquePatientIds = new Set(appointments.map((a) => a.patientId));
    const patientsCount = uniquePatientIds.size;

    // completion rate for last 30 days
    const now = new Date();
    const last30 = new Date(now);
    last30.setDate(now.getDate() - 30);
    const windowApps = appointments.filter(
      (a) => new Date(a.date).getTime() >= last30.getTime()
    );
    const completed30 = windowApps.filter((a) => a.status === "completed").length;
    const completionRate =
      windowApps.length === 0 ? 0 : Math.round((completed30 / windowApps.length) * 100);

    // weekly comparison (this week vs last week, counts)
    const thisWeekStart = startOfWeek(new Date());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    const thisWeekApps = appointments.filter(
      (a) => {
        const t = new Date(a.date);
        return t >= thisWeekStart && t <= new Date();
      }
    );
    const lastWeekApps = appointments.filter((a) => {
      const t = new Date(a.date);
      return t >= lastWeekStart && t <= lastWeekEnd;
    });

    const delta = thisWeekApps.length - lastWeekApps.length;
    const deltaPct =
      lastWeekApps.length === 0
        ? (thisWeekApps.length > 0 ? 100 : 0)
        : Math.round((delta / lastWeekApps.length) * 100);

    // Top reasons (last 30 days)
    const reasonCounts = new Map<string, number>();
    windowApps.forEach((a) => {
      const key = (a.reason || "Unspecified").trim().toLowerCase();
      reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1);
    });
    const topReasons = [...reasonCounts.entries()]
      .sort(([, av], [, bv]) => bv - av)
      .slice(0, 3)
      .map(([k, v]) => ({ reason: k, count: v }));

    return {
      pending,
      approved,
      completed,
      patientsCount,
      completionRate,
      weeklyDelta: delta,
      weeklyDeltaPct: deltaPct,
      topReasons,
    };
  }, [appointments]);

  /* ----------------------------- Trends ----------------------------- */
  // Build last 8 weeks trend: pending/approved/completed counts per week
  const trendData = useMemo(() => {
    // Collect by weekKey
    const byWeek = new Map<
      string,
      { week: string; pending: number; approved: number; completed: number }
    >();

    appointments.forEach((a) => {
      const k = weekKey(new Date(a.date));
      if (!byWeek.has(k)) {
        byWeek.set(k, { week: k, pending: 0, approved: 0, completed: 0 });
      }
      const entry = byWeek.get(k)!;
      if (a.status === "pending") entry.pending += 1;
      else if (a.status === "approved") entry.approved += 1;
      else if (a.status === "completed") entry.completed += 1;
    });

    // Sort by chronological key and pick last 8
    const sorted = [...byWeek.values()].sort((a, b) =>
      a.week.localeCompare(b.week)
    );
    return sorted.slice(-8);
  }, [appointments]);

  /* ------------------------- Today’s list --------------------------- */
  const todaysAppointments = useMemo(() => {
    const todayKey = new Date().toDateString();
    return appointments.filter(
      (a) => new Date(a.date).toDateString() === todayKey
    );
  }, [appointments]);

  /* -------------------------- Recent feed -------------------------- */
  const recentActivity = useMemo(() => {
    // Take last 6 updates (just from existing sorted list)
    return appointments.slice(0, 6).map((a) => ({
      id: a.id!,
      when: formatDateTime(a.date),
      patient: a.patientName || a.patientId,
      status: a.status,
      reason: a.reason || "—",
    }));
  }, [appointments]);

  /* -------------------------- PDF Export --------------------------- */
  async function exportWeeklyReport() {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("SmartCare Connect — Weekly Doctor Report", 10, 14);

      doc.setFontSize(11);
      doc.text(`Doctor: ${doctorName}`, 10, 24);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 10, 30);

      let y = 42;
      doc.setFontSize(13);
      doc.text("KPIs (Last 30 days):", 10, y);
      y += 8;

      doc.setFontSize(11);
      doc.text(`Patients: ${stats.patientsCount}`, 10, y);
      y += 6;
      doc.text(`Completion Rate: ${stats.completionRate}%`, 10, y);
      y += 6;
      doc.text(
        `Weekly Change: ${stats.weeklyDelta > 0 ? "+" : ""}${stats.weeklyDelta} (${stats.weeklyDeltaPct > 0 ? "+" : ""}${stats.weeklyDeltaPct}%)`,
        10,
        y
      );
      y += 10;

      doc.setFontSize(13);
      doc.text("Top Reasons:", 10, y);
      y += 8;
      doc.setFontSize(11);
      if (stats.topReasons.length === 0) {
        doc.text("— No data in last 30 days —", 10, y);
        y += 6;
      } else {
        stats.topReasons.forEach((r) => {
          doc.text(`• ${r.reason} (${r.count})`, 10, y);
          y += 6;
        });
      }

      y += 10;
      doc.setFontSize(13);
      doc.text("Today’s Appointments:", 10, y);
      y += 8;
      doc.setFontSize(11);
      if (todaysAppointments.length === 0) {
        doc.text("— None —", 10, y);
      } else {
        todaysAppointments.forEach((a) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(
            `${formatTime(a.date)} • ${a.patientName || a.patientId} • ${
              a.status
            } • ${a.reason || "—"}`,
            10,
            y
          );
          y += 6;
        });
      }

      doc.save("smartcare-weekly-report.pdf");
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF. Please try again.");
    }
  }

  /* --------------------------- UI helpers --------------------------- */

  const StatCard = ({
    title,
    value,
    accentClass,
  }: {
    title: string;
    value: number;
    accentClass: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border border-white/10 bg-white/5 p-5 text-white shadow backdrop-blur`}
    >
      <div className="text-sm text-white/70">{title}</div>
      <div className={`mt-2 text-3xl font-bold ${accentClass}`}>
        <CountUp end={value || 0} duration={1.2} separator="," />
      </div>
    </motion.div>
  );

  /* ----------------------------- Render ----------------------------- */

  if (loading) return <p className="p-6">Loading dashboard...</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
      <div className="mx-auto w-full max-w-6xl p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow backdrop-blur"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm text-white/60">Welcome back</div>
              <h1 className="text-2xl font-bold">{doctorName}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/doctor/appointments"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage Appointments
              </Link>
              <Link
                href="/doctor/patients"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Patients
              </Link>
              <Link
                href="/doctor/profile"
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Edit Profile
              </Link>
              <div
                role="button"
                tabIndex={0}
                onClick={exportWeeklyReport}
                onKeyDown={(e) => e.key === "Enter" && exportWeeklyReport()}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 cursor-pointer select-none"
              >
                Export Week PDF
              </div>
            </div>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard title="Pending" value={stats.pending} accentClass="text-yellow-300" />
          <StatCard title="Approved" value={stats.approved} accentClass="text-blue-300" />
          <StatCard title="Completed" value={stats.completed} accentClass="text-emerald-300" />
          <StatCard title="Patients" value={stats.patientsCount} accentClass="text-purple-300" />
        </div>

        {/* Middle: Trend + KPIs */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Trend chart */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 shadow backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold">📈 Weekly Appointments Trend</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData.length ? trendData : [{ week: "N/A", pending: 0, approved: 0, completed: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="week" stroke="#bbb" />
                <YAxis stroke="#bbb" />
                <Tooltip
                  contentStyle={{ background: "#0b0b0b", border: "1px solid #333", color: "#fff" }}
                />
                <Legend />
                <Line type="monotone" dataKey="pending" stroke="#facc15" strokeWidth={2} />
                <Line type="monotone" dataKey="approved" stroke="#60a5fa" strokeWidth={2} />
                <Line type="monotone" dataKey="completed" stroke="#34d399" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* KPIs right */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow">
              <div className="text-sm text-white/70">Completion Rate (30d)</div>
              <div
                className={`mt-2 text-3xl font-bold ${
                  stats.completionRate >= 75
                    ? "text-emerald-300"
                    : stats.completionRate >= 50
                    ? "text-yellow-300"
                    : "text-red-300"
                }`}
              >
                <CountUp end={stats.completionRate} duration={1} />%
              </div>
              <div className="mt-3 text-sm text-white/70">
                Weekly change:{" "}
                <span
                  className={
                    stats.weeklyDelta >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"
                  }
                >
                  {stats.weeklyDelta >= 0 ? "+" : ""}
                  {stats.weeklyDelta} ({stats.weeklyDeltaPct >= 0 ? "+" : ""}
                  {stats.weeklyDeltaPct}%)
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow">
              <div className="text-sm font-semibold">Top Reasons (30d)</div>
              <ul className="mt-2 space-y-1 text-sm">
                {stats.topReasons.length === 0 && (
                  <li className="text-white/60">No data yet.</li>
                )}
                {stats.topReasons.map((r) => (
                  <li key={r.reason} className="flex items-center justify-between">
                    <span className="capitalize text-white/80">{r.reason}</span>
                    <span className="text-white/60">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Today's Appointments + Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
            <h2 className="mb-3 text-lg font-semibold">🗓 Today’s Appointments</h2>
            {todaysAppointments.length === 0 ? (
              <p className="text-white/60">No appointments today.</p>
            ) : (
              <div className="space-y-2">
                {todaysAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 p-3"
                  >
                    <div>
                      <div className="font-medium">{a.patientName || "Unknown"}</div>
                      <div className="text-sm text-white/70">{a.reason || "—"}</div>
                      <div className="text-xs text-white/50">{a.status}</div>
                    </div>
                    <div className="text-sm text-white/70">{formatTime(a.date)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
            <h2 className="mb-3 text-lg font-semibold">📰 Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-white/60">No recent updates.</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-lg border border-white/10 bg-black/40 p-3"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{it.patient}</span>{" "}
                      <span className="text-white/70">• {it.reason}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      {it.when} — {it.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/doctor/appointments"
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Manage Appointments
          </Link>
          <Link
            href="/doctor/patients"
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Patients
          </Link>
          <Link
            href="/doctor/profile"
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Edit Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
