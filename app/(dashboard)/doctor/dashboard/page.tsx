"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByDoctor, Appointment } from "@/lib/appointments";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";

interface AppointmentWithPatient extends Appointment {
  patientName?: string;
}

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  // 🔹 Helper to fetch patient name
  const getPatientName = async (uid: string): Promise<string> => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const data = snap.data() as { fullName?: string; name?: string };
        return data.fullName || data.name || uid;
      }
    } catch {
      return uid;
    }
    return uid;
  };

  // 🔹 Load appointments + attach patient names
  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);
      const apps = await getAppointmentsByDoctor(user.uid);

      const withNames = await Promise.all(
        apps.map(async (a) => ({
          ...a,
          patientName: await getPatientName(a.patientId),
        }))
      );

      setAppointments(withNames);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <p className="p-6">Loading dashboard...</p>;

  // 🟢 Stats
  const pending = appointments.filter((a) => a.status === "pending").length;
  const approved = appointments.filter((a) => a.status === "approved").length;
  const completed = appointments.filter((a) => a.status === "completed").length;

  // 🟢 Today’s Appointments
  const today = new Date().toDateString();
  const todaysAppointments = appointments.filter(
    (a) => new Date(a.date).toDateString() === today
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Doctor Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-black text-white rounded shadow">
          <h2 className="text-lg font-semibold">Pending</h2>
          <p className="text-2xl">{pending}</p>
        </div>
        <div className="p-4 bg-black text-white rounded shadow">
          <h2 className="text-lg font-semibold">Approved</h2>
          <p className="text-2xl">{approved}</p>
        </div>
        <div className="p-4 bg-black text-white rounded shadow">
          <h2 className="text-lg font-semibold">Completed</h2>
          <p className="text-2xl">{completed}</p>
        </div>
      </div>

      {/* Today’s appointments */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Today’s Appointments</h2>
        {todaysAppointments.length === 0 ? (
          <p className="text-gray-500">No appointments today.</p>
        ) : (
          <div className="space-y-2">
            {todaysAppointments.map((a) => (
              <div
                key={a.id}
                className="p-3 border rounded bg-gray-50 flex justify-between text-black"
              >
                <div>
                  <p>
                    <b>Patient:</b> {a.patientName || "Unknown"}
                  </p>
                  <p>
                    <b>Reason:</b> {a.reason}
                  </p>
                  <p>
                    <b>Status:</b> {a.status}
                  </p>
                </div>
                <div className="text-sm text-gray-500 pl-4">
                  {new Date(a.date).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link
          href="/doctor/appointments"
          className="px-4 py-2 rounded bg-black text-white"
        >
          Manage Appointments
        </Link>
        <Link
          href="/doctor/profile"
          className="px-4 py-2 rounded bg-gray-700 text-white"
        >
          Edit Profile
        </Link>
      </div>
    </div>
  );
}
