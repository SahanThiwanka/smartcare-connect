"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByDoctor } from "@/lib/appointments";
import { getPatientRecords, RecordFile } from "@/lib/records";

export default function DoctorPatientsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // 1. Get doctor’s appointments
      const appointments = await getAppointmentsByDoctor(user.uid);
      const patientIds = [...new Set(appointments.map((a) => a.patientId))];

      // 2. Get all patient records for those patients
      let allRecords: RecordFile[] = [];
      for (const pid of patientIds) {
        const recs = await getPatientRecords(pid);
        allRecords = [...allRecords, ...recs];
      }

      setRecords(allRecords);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">My Patients’ Records</h2>
      {loading && <p>Loading...</p>}
      {records.length === 0 && !loading && <p>No records available.</p>}

      <div className="grid gap-3">
        {records.map((r) => (
          <div key={r.id} className="rounded border p-3 flex justify-between">
            <span>{r.fileName}</span>
            <a
              href={r.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
