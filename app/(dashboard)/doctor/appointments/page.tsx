"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAppointmentsByDoctor,
  approveAppointment,
  declineAppointment,
  completeAppointment,
  Appointment,
} from "@/lib/appointments";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type FirestorePatient = {
  fullName?: string;
  email: string;
  phone?: string;
};

type PatientInfo = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
};

export default function DoctorAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [patients, setPatients] = useState<Record<string, PatientInfo>>({});

  const loadAppointments = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const apps = await getAppointmentsByDoctor(user.uid);
    setAppointments(apps);

    const patientData: Record<string, PatientInfo> = {};
    for (const a of apps) {
      if (!a.patientId || patientData[a.patientId]) continue;

      const snap = await getDoc(doc(db, "users", a.patientId));
      if (snap.exists()) {
        const d = snap.data() as FirestorePatient;
        patientData[a.patientId] = {
          id: snap.id,
          fullName: d.fullName ?? "Unknown",
          email: d.email,
          phone: d.phone ?? "-",
        };
      }
    }

    setPatients(patientData);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const updateLocalStatus = (
    id: string,
    status: Appointment["status"],
    notes?: string
  ) => {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status, notes: notes ?? a.notes } : a
      )
    );
  };

  const handleApprove = async (id: string) => {
    await approveAppointment(id);
    updateLocalStatus(id, "approved");
  };

  const handleDecline = async (id: string) => {
    await declineAppointment(id);
    updateLocalStatus(id, "declined");
  };

  const handleComplete = async (id: string) => {
    if (!notes[id]) return alert("Please enter notes before completing.");
    await completeAppointment(id, notes[id]);
    updateLocalStatus(id, "completed", notes[id]);
    setNotes((prev) => ({ ...prev, [id]: "" }));
  };

  const statusColor = (status: Appointment["status"]) => {
    switch (status) {
      case "pending":
        return "text-yellow-500";
      case "approved":
        return "text-green-500";
      case "declined":
        return "text-red-500";
      case "completed":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-semibold">Appointments</h2>

      {loading && <p>Loading appointments...</p>}
      {!loading && appointments.length === 0 && (
        <p>No appointments assigned yet.</p>
      )}

      <div className="space-y-4">
        {appointments.map((a) => {
          const p = patients[a.patientId];
          return (
            <div
              key={a.id}
              className="rounded border p-4 shadow space-y-2"
            >
              <p>
                <b>Patient:</b> {p?.fullName || a.patientId} <br />
                <span className="text-sm text-gray-500">
                  {p?.email} | {p?.phone}
                </span>
              </p>
              <p>
                <b>Date:</b> {a.date ? new Date(a.date).toLocaleString() : "-"}
              </p>
              <p>
                <b>Reason:</b> {a.reason}
              </p>
              <p className={statusColor(a.status)}>
                <b>Status:</b> {a.status}
              </p>
              {a.notes && (
                <p className="p-2 bg-gray-600 rounded">
                  <b>Notes:</b> {a.notes}
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
                      setNotes((prev) => ({
                        ...prev,
                        [a.id!]: e.target.value,
                      }))
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
          );
        })}
      </div>
    </div>
  );
}
