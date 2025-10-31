// ./app/(dashboard)/patient/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByPatient, Appointment } from "@/lib/appointments";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  type DocumentReference,
} from "firebase/firestore";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Hourglass,
  User,
  Stethoscope,
  Activity,
  HeartPulse,
  Weight,
  Thermometer,
  ClipboardList,
  Droplet,
} from "lucide-react";

/* =========================
   Daily measure types & helpers
========================= */

type DailyMeasure = {
  date: string;

  // legacy strings (back-compat)
  pressure?: string;
  cholesterol?: string;
  sugar?: string; // fasting
  sugarPost?: string; // 2h post
  spo2?: string;
  exerciseTime?: string;
  temperature?: string;
  weight?: string;
  height?: string;
  waterIntake?: string;

  // numeric preferred
  systolic?: number;
  diastolic?: number;
  sugarMgDl?: number;
  sugarPostMgDl?: number;
  cholesterolTotal?: number;
  spo2Pct?: number;
  exerciseMins?: number;
  temperatureC?: number;
  weightKg?: number;
  heightCm?: number;
  waterIntakeL?: number;
};

type Status = "Good" | "OK" | "Bad" | "Emergency";

function toNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n =
    typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}
function parseBP(raw?: string): { systolic?: number; diastolic?: number } {
  if (!raw) return {};
  const m = raw.match(/(\d{2,3})\D+(\d{2,3})/);
  if (!m) return {};
  return { systolic: toNum(m[1]), diastolic: toNum(m[2]) };
}
function normalize(rec: DailyMeasure): DailyMeasure {
  const { systolic, diastolic } =
    rec.systolic != null && rec.diastolic != null
      ? { systolic: rec.systolic, diastolic: rec.diastolic }
      : parseBP(rec.pressure);

  return {
    ...rec,
    systolic,
    diastolic,
    sugarMgDl: rec.sugarMgDl ?? toNum(rec.sugar),
    sugarPostMgDl: rec.sugarPostMgDl ?? toNum(rec.sugarPost),
    cholesterolTotal: rec.cholesterolTotal ?? toNum(rec.cholesterol),
    spo2Pct: rec.spo2Pct ?? toNum(rec.spo2),
    exerciseMins: rec.exerciseMins ?? toNum(rec.exerciseTime),
    temperatureC: rec.temperatureC ?? toNum(rec.temperature),
    weightKg: rec.weightKg ?? toNum(rec.weight),
    heightCm: rec.heightCm ?? toNum(rec.height),
    waterIntakeL: rec.waterIntakeL ?? toNum(rec.waterIntake),
  };
}
function calcBMI(weightKg?: number, heightCm?: number): number | undefined {
  if (!weightKg || !heightCm) return undefined;
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  return Number.isFinite(bmi) ? Number(Math.round(bmi * 10) / 10) : undefined;
}
function statusBP(s?: number, d?: number): Status | undefined {
  if (s == null || d == null) return undefined;
  if (s > 180 || d > 120) return "Emergency";
  if (s < 120 && d < 80) return "Good";
  if (s >= 120 && s <= 129 && d < 80) return "OK";
  return "Bad";
}
function statusSugarFasting(mgdl?: number): Status | undefined {
  if (mgdl == null) return undefined;
  if (mgdl >= 70 && mgdl <= 99) return "Good";
  if (mgdl >= 100 && mgdl <= 125) return "OK";
  if (mgdl >= 126) return "Bad";
  return undefined;
}
function statusSugarPost(mgdl?: number): Status | undefined {
  if (mgdl == null) return undefined;
  if (mgdl <= 139) return "Good";
  if (mgdl >= 140 && mgdl <= 199) return "OK";
  if (mgdl >= 200) return "Bad";
  return undefined;
}
function statusCholTotal(mgdl?: number): Status | undefined {
  if (mgdl == null) return undefined;
  if (mgdl <= 199) return "Good";
  if (mgdl >= 200 && mgdl <= 239) return "OK";
  if (mgdl >= 240) return "Bad";
  return undefined;
}
function statusSpO2(pct?: number): Status | undefined {
  if (pct == null) return undefined;
  if (pct >= 95) return "Good";
  if (pct >= 90) return "OK";
  return "Bad";
}
function statusTemp(c?: number): Status | undefined {
  if (c == null) return undefined;
  if (c >= 36.1 && c <= 37.2) return "Good";
  if ((c >= 37.3 && c <= 38.0) || c < 36.0) return "OK";
  if (c >= 38.1) return "Bad";
  return undefined;
}
function statusBMI(bmi?: number): Status | undefined {
  if (bmi == null) return undefined;
  if (bmi >= 18.5 && bmi <= 24.9) return "Good";
  if ((bmi >= 25.0 && bmi <= 29.9) || bmi < 18.5) return "OK";
  if (bmi >= 30.0) return "Bad";
  return undefined;
}
function chip(status?: Status) {
  if (!status) return null;
  const map: Record<Status, string> = {
    Good: "bg-green-500/20 text-green-300 border-green-400/30",
    OK: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
    Bad: "bg-red-500/20 text-red-300 border-red-400/30",
    Emergency: "bg-red-700/30 text-red-200 border-red-500/50",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}

/* =========================
   Firestore typing for doctor names
========================= */

type DoctorNameDoc = {
  fullName?: string;
  name?: string;
};
type DocRef<T> = DocumentReference<T>;

/* =========================
   Component
========================= */

export default function PatientDashboardPage() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [healthRaw, setHealthRaw] = useState<DailyMeasure | null>(null);
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // load appointments + latest daily measure
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const apps = await getAppointmentsByPatient(user.uid);
      const sorted = [...apps].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setAppointments(sorted);

      const qy = query(
        collection(db, "users", user.uid, "dailyMeasures"),
        orderBy("date", "desc")
      );
      const snap = await getDocs(qy);
      const latest = (snap.docs[0]?.data() as DailyMeasure | undefined) ?? null;
      setHealthRaw(latest);

      setLoading(false);
    })();
  }, [user]);

  // fetch & cache doctor names (typed, no any)
  useEffect(() => {
    (async () => {
      const ids = Array.from(new Set(appointments.map((a) => a.doctorId))).filter(
        (id) => id && !doctorNames[id]
      );
      if (!ids.length) return;

      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const ref = doc(db, "users", id) as DocRef<DoctorNameDoc>;
            const s = await getDoc(ref);
            const data = s.data(); // DoctorNameDoc | undefined
            const display =
              (s.exists() && (data?.fullName || data?.name)) || id;
            return [id, display] as const;
          } catch {
            return [id, id] as const;
          }
        })
      );

      setDoctorNames((prev) =>
        Object.fromEntries([...Object.entries(prev), ...entries])
      );
    })();
  }, [appointments, doctorNames]);

  // derived values (safe even while loading)
  const now = new Date();
  const upcoming = appointments.filter(
    (a) => a.status === "approved" && new Date(a.date) > now
  ).length;
  const pending = appointments.filter((a) => a.status === "pending").length;
  const completed = appointments.filter((a) => a.status === "completed").length;

  const nextAppointment = appointments
    .filter((a) => new Date(a.date) > now && a.status === "approved")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const recentAppointments = [...appointments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const health = healthRaw ? normalize(healthRaw) : null;
  const bmi = calcBMI(health?.weightKg, health?.heightCm);

  // keep this hook BEFORE any returns; it must run every render
  const healthCards = useMemo(
    () =>
      [
        {
          key: "bp",
          icon: <Activity className="h-4 w-4" />,
          label: "Blood Pressure",
          value:
            health?.systolic != null && health?.diastolic != null
              ? `${health.systolic}/${health.diastolic} mmHg`
              : health?.pressure || "-",
          status: statusBP(health?.systolic, health?.diastolic),
        },
        {
          key: "temp",
          icon: <Thermometer className="h-4 w-4" />,
          label: "Temperature",
          value:
            health?.temperatureC != null
              ? `${health.temperatureC} °C`
              : health?.temperature
              ? `${health.temperature} °C`
              : "-",
          status: statusTemp(health?.temperatureC),
        },
        {
          key: "weight",
          icon: <Weight className="h-4 w-4" />,
          label: "Weight",
          value:
            health?.weightKg != null
              ? `${health.weightKg} kg`
              : health?.weight
              ? `${health.weight} kg`
              : "-",
          status: bmi != null ? statusBMI(bmi) : undefined,
        },
        {
          key: "sugarFast",
          icon: <HeartPulse className="h-4 w-4" />,
          label: "Fasting Sugar",
          value:
            health?.sugarMgDl != null
              ? `${health.sugarMgDl} mg/dL`
              : health?.sugar || "-",
          status: statusSugarFasting(health?.sugarMgDl),
        },
        {
          key: "sugarPost",
          icon: <HeartPulse className="h-4 w-4" />,
          label: "2h Post Sugar",
          value:
            health?.sugarPostMgDl != null
              ? `${health.sugarPostMgDl} mg/dL`
              : health?.sugarPost || "-",
          status: statusSugarPost(health?.sugarPostMgDl),
        },
        {
          key: "chol",
          icon: <HeartPulse className="h-4 w-4" />,
          label: "Cholesterol",
          value:
            health?.cholesterolTotal != null
              ? `${health.cholesterolTotal} mg/dL`
              : health?.cholesterol || "-",
          status: statusCholTotal(health?.cholesterolTotal),
        },
        {
          key: "spo2",
          icon: <Droplet className="h-4 w-4" />,
          label: "SpO₂",
          value:
            health?.spo2Pct != null
              ? `${health.spo2Pct}%`
              : health?.spo2
              ? `${health.spo2}%`
              : "-",
          status: statusSpO2(health?.spo2Pct),
        },
        {
          key: "bmi",
          icon: <Activity className="h-4 w-4" />,
          label: "BMI",
          value: bmi != null ? `${bmi} kg/m²` : "-",
          status: statusBMI(bmi),
        },
      ].filter((c) => c.value && c.value !== "-"),
    [health, bmi]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white py-10 px-6">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold">
            Welcome back,{" "}
            <span className="text-green-400">
              {user?.displayName || user?.email?.split("@")[0] || "Patient"}
            </span>
          </h1>
          <p className="text-white/70 mt-1">
            Your personalized health overview and appointment summary.
          </p>
        </motion.div>

        {/* Optional loading banner (no early return) */}
        {loading && (
          <p className="p-4 rounded-xl border border-white/10 bg-white/5 text-white/70 animate-pulse">
            Loading your data…
          </p>
        )}

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              label: "Upcoming",
              value: upcoming,
              icon: <CalendarDays className="h-6 w-6 text-green-400" />,
            },
            {
              label: "Pending",
              value: pending,
              icon: <Hourglass className="h-6 w-6 text-yellow-400" />,
            },
            {
              label: "Completed",
              value: completed,
              icon: <CheckCircle2 className="h-6 w-6 text-blue-400" />,
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              whileHover={{ scale: 1.03 }}
              className="p-5 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">{stat.label}</h2>
                {stat.icon}
              </div>
              <p className="text-3xl font-bold">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Health Summary */}
        {health && (
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-red-400" /> Latest Health
              Summary
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {healthCards.map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col gap-1 hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2 text-white/70">
                    {item.icon}
                    <span className="text-sm">{item.label}</span>
                    {chip(item.status)}
                  </div>
                  <p className="text-xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Appointment */}
        <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-green-400" /> Next Appointment
          </h2>
          {nextAppointment ? (
            <div className="rounded-xl bg-black/40 border border-white/10 p-4">
              <p className="font-semibold text-lg flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-white/70" />
                Doctor:{" "}
                <span className="text-green-400">
                  {doctorNames[nextAppointment.doctorId] ??
                    nextAppointment.doctorId}
                </span>
              </p>
              <p className="text-sm text-white/70 mt-1">
                Reason: {nextAppointment.reason || "No reason specified"}
              </p>
              <p className="mt-2 text-base">
                {new Date(nextAppointment.date).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p className="mt-2 text-green-400 font-medium">
                Status: {nextAppointment.status.toUpperCase()}
              </p>
            </div>
          ) : (
            <p className="text-white/70">No upcoming appointments.</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-400" /> Recent Activity
          </h2>
          <ul className="space-y-3">
            {recentAppointments.length > 0 ? (
              recentAppointments.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between items-center border border-white/10 rounded-lg bg-black/30 p-3 hover:bg-white/5 transition"
                >
                  <div>
                    <p className="font-medium">
                      Appointment with{" "}
                      <span className="text-green-400">
                        {doctorNames[a.doctorId] ?? a.doctorId}
                      </span>
                    </p>
                    <p className="text-xs text-white/70">
                      {new Date(a.date).toLocaleDateString()} —{" "}
                      {a.reason || "No reason"}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs rounded-full font-medium ${
                      a.status === "approved"
                        ? "bg-green-600/30 text-green-300"
                        : a.status === "completed"
                        ? "bg-blue-600/30 text-blue-300"
                        : a.status === "declined"
                        ? "bg-red-600/30 text-red-300"
                        : "bg-yellow-600/30 text-yellow-300"
                    }`}
                  >
                    {a.status}
                  </span>
                </li>
              ))
            ) : (
              <p className="text-white/70 text-sm">No recent activity found.</p>
            )}
          </ul>
        </div>

        {/* Quick Links */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              href: "/patient/appointments",
              label: "Book Appointment",
              icon: <CalendarDays className="h-5 w-5" />,
              color: "bg-green-600 hover:bg-green-500",
            },
            {
              href: "/patient/history",
              label: "View History",
              icon: <Clock className="h-5 w-5" />,
              color: "bg-gray-700 hover:bg-gray-600",
            },
            {
              href: "/patient/profile",
              label: "Edit Profile",
              icon: <User className="h-5 w-5" />,
              color: "bg-gray-700 hover:bg-gray-600",
            },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${link.color} flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
