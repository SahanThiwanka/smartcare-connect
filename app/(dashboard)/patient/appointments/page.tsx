"use client";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  createAppointment,
  getAppointmentsByPatient,
  Appointment,
} from "@/lib/appointments";
import { getApprovedDoctors, Doctor } from "@/lib/doctors";

export default function PatientAppointmentsPage() {
  const { user } = useAuth();
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load patient appointments
  useEffect(() => {
    if (!user) return;
    (async () => {
      const apps = await getAppointmentsByPatient(user.uid);
      setAppointments(apps);
    })();
  }, [user]);

  // Load approved doctors
  useEffect(() => {
    (async () => {
      const docs = await getApprovedDoctors();
      setDoctors(docs);
    })();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !doctorId) return;
    setError(null);
    setLoading(true);
    try {
      await createAppointment({
          patientId: user.uid,
          doctorId,
          date,
          reason,
          status: "pending",
          createdAt: Date.now(),
          notes: undefined
      });
      setDoctorId("");
      setDate("");
      setReason("");
      const apps = await getAppointmentsByPatient(user.uid);
      setAppointments(apps);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">My Appointments</h2>

      {/* Appointment booking form */}
      <form onSubmit={onSubmit} className="grid gap-3 max-w-md">
        <select
          className="rounded border p-2"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
        >
          <option value="">-- Select Doctor --</option>
          {doctors.map((doc) => (
            <option key={doc.uid} value={doc.uid}>
              {doc.name} ({doc.specialty})
            </option>
          ))}
        </select>

        <input
          className="rounded border p-2"
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <textarea
          className="rounded border p-2"
          placeholder="Reason for appointment"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white"
        >
          {loading ? "Booking..." : "Book Appointment"}
        </button>
      </form>

      {/* Appointment list */}
      <div className="grid gap-2">
        <h3 className="text-lg font-semibold">My Bookings</h3>
        {appointments.length === 0 && <p>No appointments yet.</p>}
        {appointments.map((a) => (
          <div key={a.id} className="rounded border p-3">
            <p>
              <span className="font-semibold">Doctor:</span>{" "}
              {doctors.find((d) => d.uid === a.doctorId)?.name || a.doctorId}
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
            {a.status === "completed" && a.notes && (
              <p className="mt-2 p-2 rounded bg-black-50 border text-sm">
                <span className="font-semibold">Doctor’s Notes:</span> {a.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
