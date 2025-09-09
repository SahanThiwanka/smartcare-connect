"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByPatient, Appointment } from "@/lib/appointments";
import Link from "next/link";

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const apps = await getAppointmentsByPatient(user.uid);
      setAppointments(apps);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <p className="p-6">Loading dashboard...</p>;

  // 🟢 Stats
  const upcoming = appointments.filter(
    (a) => a.status === "approved" && new Date(a.date) > new Date()
  ).length;
  const pending = appointments.filter((a) => a.status === "pending").length;
  const completed = appointments.filter((a) => a.status === "completed").length;

  // 🟢 Next appointment
  const nextAppointment = appointments
    .filter((a) => new Date(a.date) > new Date() && a.status === "approved")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Patient Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-black text-white rounded shadow">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <p className="text-2xl">{upcoming}</p>
        </div>
        <div className="p-4 bg-black text-white rounded shadow">
          <h2 className="text-lg font-semibold">Pending</h2>
          <p className="text-2xl">{pending}</p>
        </div>
        <div className="p-4 bg-black text-white rounded shadow">
          <h2 className="text-lg font-semibold">Completed</h2>
          <p className="text-2xl">{completed}</p>
        </div>
      </div>

      {/* Next Appointment */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Next Appointment</h2>
        {nextAppointment ? (
          <div className="p-3 border rounded bg-gray-50">
            <p>
              <b>Doctor:</b> {nextAppointment.doctorId}
            </p>
            <p>
              <b>Date:</b>{" "}
              {new Date(nextAppointment.date).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p>
              <b>Reason:</b> {nextAppointment.reason}
            </p>
            <p>
              <b>Status:</b> {nextAppointment.status}
            </p>
          </div>
        ) : (
          <p className="text-gray-500">No upcoming appointments.</p>
        )}
      </div>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link
          href="/patient/appointments"
          className="px-4 py-2 rounded bg-black text-white"
        >
          Book Appointment
        </Link>
        <Link
          href="/patient/profile"
          className="px-4 py-2 rounded bg-gray-700 text-white"
        >
          Edit Profile
        </Link>
        <Link
          href="/patient/history"
          className="px-4 py-2 rounded bg-gray-700 text-white"
        >
          View History
        </Link>
      </div>
    </div>
  );
}
