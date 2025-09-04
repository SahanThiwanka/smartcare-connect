"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByPatient, Appointment } from "@/lib/appointments";
import { getPatientRecords, RecordFile } from "@/lib/records";
import { getDoctorInfo } from "@/lib/doctors";

type AppointmentWithDoctor = Appointment & { doctorName?: string };

export default function PatientHistoryPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[]>([]);
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // 1. Load appointments
      const apps = await getAppointmentsByPatient(user.uid);

      // Fetch doctor names for each appointment
      const withDocs = await Promise.all(
        apps.map(async (a) => {
          const docInfo = await getDoctorInfo(a.doctorId);
          return { ...a, doctorName: docInfo ? docInfo.name : a.doctorId };
        })
      );

      // 2. Load records
      const recs = await getPatientRecords(user.uid);

      setAppointments(withDocs);
      setRecords(recs);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">My Medical History</h2>
      {loading && <p>Loading...</p>}

      {/* Appointment History */}
      <div>
        <h3 className="text-lg font-semibold">Appointments</h3>
        {appointments.length === 0 && <p>No appointments yet.</p>}
        <div className="grid gap-3">
          {appointments.map((a) => (
            <div key={a.id} className="rounded border p-3">
              <p>
                <span className="font-semibold">Doctor:</span> {a.doctorName}
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
                  <span className="font-semibold">Doctor’s Notes:</span>{" "}
                  {a.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Health Records */}
      <div>
        <h3 className="text-lg font-semibold">Uploaded Records</h3>
        {records.length === 0 && <p>No records uploaded yet.</p>}
        <div className="grid gap-2">
          {records.map((r) => (
            <a
              key={r.id}
              href={r.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:underline"
            >
              {r.fileName}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
