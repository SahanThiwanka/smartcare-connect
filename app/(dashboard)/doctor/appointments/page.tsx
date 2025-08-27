"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAppointmentsByDoctor,
  approveAppointment,
  declineAppointment,
  completeAppointment,
  Appointment,
} from "@/lib/appointments";

export default function DoctorAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<{ [key: string]: string }>({});

  const loadAppointments = async () => {
    if (!user) return;
    setLoading(true);
    const apps = await getAppointmentsByDoctor(user.uid);
    setAppointments(apps);
    setLoading(false);
  };

  useEffect(() => {
    loadAppointments();
  }, [user]);

  const handleApprove = async (id: string) => {
    await approveAppointment(id);
    loadAppointments();
  };

  const handleDecline = async (id: string) => {
    await declineAppointment(id);
    loadAppointments();
  };

  const handleComplete = async (id: string) => {
    if (!notes[id]) return;
    await completeAppointment(id, notes[id]);
    setNotes((prev) => ({ ...prev, [id]: "" }));
    loadAppointments();
  };

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">Appointments</h2>

      {loading && <p>Loading...</p>}

      {appointments.length === 0 && !loading && (
        <p>No appointments assigned yet.</p>
      )}

      <div className="grid gap-3">
        {appointments.map((a) => (
          <div key={a.id} className="rounded border p-3 flex flex-col gap-2">
            <p>
              <span className="font-semibold">Patient ID:</span> {a.patientId}
            </p>
            <p>
              <span className="font-semibold">Date:</span>{" "}
              {new Date(a.date).toLocaleString()}
            </p>
            <p>
              <span className="font-semibold">Reason:</span> {a.reason}
            </p>
            <p>
              <span className="font-semibold">Status:</span> {a.status}
            </p>
            {a.notes && (
              <p>
                <span className="font-semibold">Notes:</span> {a.notes}
              </p>
            )}

            {a.status === "pending" && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(a.id!)}
                  className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecline(a.id!)}
                  className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                >
                  Decline
                </button>
              </div>
            )}

            {a.status === "approved" && (
              <div className="flex flex-col gap-2">
                <textarea
                  className="rounded border p-2"
                  placeholder="Enter notes / diagnosis"
                  value={notes[a.id!] || ""}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [a.id!]: e.target.value }))
                  }
                />
                <button
                  onClick={() => handleComplete(a.id!)}
                  className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                >
                  Mark as Completed
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
