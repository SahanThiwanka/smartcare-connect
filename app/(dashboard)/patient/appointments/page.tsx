"use client";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  createAppointment,
  getAppointmentsByPatient,
  cancelAppointment,
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
  const [success, setSuccess] = useState<string | null>(null);

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

  const refreshAppointments = async () => {
    if (!user) return;
    const apps = await getAppointmentsByPatient(user.uid);
    setAppointments(apps);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!doctorId || !date || !reason.trim()) {
      setError("Please select a doctor, date, and enter a reason.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await createAppointment({
        patientId: user.uid,
        doctorId,
        date,
        reason,
        status: "pending",
        createdAt: Date.now(),
      });
      setDoctorId("");
      setDate("");
      setReason("");
      await refreshAppointments();
      setSuccess("Appointment booked successfully! Awaiting confirmation.");
    } catch (err: any) {
      setError(err.message || "Failed to book appointment.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this appointment?")) return;
    await cancelAppointment(id);
    await refreshAppointments();
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
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-semibold">My Appointments</h2>

      {/* Booking form */}
      <form
        onSubmit={onSubmit}
        className="grid gap-3 p-4 border rounded bg-gray-50"
      >
        <select
          className="rounded border p-2"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
        >
          <option value="">-- Select Doctor --</option>
          {doctors.map((d) => (
            <option key={d.uid} value={d.uid}>
              {d.name} ({d.specialty})
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
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white"
        >
          {loading ? "Booking..." : "Book Appointment"}
        </button>
      </form>

      {/* Appointments list */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">My Bookings</h3>
        {appointments.length === 0 && <p>No appointments yet.</p>}
        {appointments.map((a) => (
          <div key={a.id} className="rounded border p-4 bg-white shadow">
            <p>
              <b>Doctor:</b>{" "}
              {doctors.find((d) => d.uid === a.doctorId)?.name || a.doctorId}
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
            {a.status === "completed" && a.notes && (
              <p className="mt-2 p-2 rounded bg-gray-100 text-sm">
                <b>Doctor’s Notes:</b> {a.notes}
              </p>
            )}
            {a.status === "pending" && (
              <button
                onClick={() => handleCancel(a.id!)}
                className="mt-2 rounded bg-red-500 px-3 py-1 text-white text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
