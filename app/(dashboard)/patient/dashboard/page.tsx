"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByPatient, Appointment } from "@/lib/appointments";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
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
} from "lucide-react";

type DailyMeasure = {
  date: string;
  pressure?: string;
  sugar?: string;
  weight?: string;
  temperature?: string;
  spo2?: string;
};

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [health, setHealth] = useState<DailyMeasure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const apps = await getAppointmentsByPatient(user.uid);
      setAppointments(apps);

      const q = query(
        collection(db, "users", user.uid, "dailyMeasures"),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      const latest = snap.docs.map((d) => d.data() as DailyMeasure)[0] || null;
      setHealth(latest);

      setLoading(false);
    })();
  }, [user]);

  if (loading)
    return (
      <p className="p-6 text-center text-white/70 animate-pulse">
        Loading dashboard...
      </p>
    );

  const upcoming = appointments.filter(
    (a) => a.status === "approved" && new Date(a.date) > new Date()
  ).length;
  const pending = appointments.filter((a) => a.status === "pending").length;
  const completed = appointments.filter((a) => a.status === "completed").length;

  const nextAppointment = appointments
    .filter((a) => new Date(a.date) > new Date() && a.status === "approved")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const recentAppointments = [...appointments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

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
              {[
                {
                  icon: <Activity />,
                  label: "Blood Pressure",
                  value: health.pressure || "-",
                },
                {
                  icon: <Thermometer />,
                  label: "Temperature",
                  value: health.temperature ? `${health.temperature}°C` : "-",
                },
                {
                  icon: <Weight />,
                  label: "Weight",
                  value: health.weight ? `${health.weight} kg` : "-",
                },
                {
                  icon: <HeartPulse />,
                  label: "Sugar",
                  value: health.sugar || "-",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col gap-1 hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2 text-white/70">
                    {item.icon}
                    <span className="text-sm">{item.label}</span>
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
                  {nextAppointment.doctorId}
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
                      <span className="text-green-400">{a.doctorId}</span>
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
