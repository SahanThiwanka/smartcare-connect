'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAppointmentsByDoctor, Appointment } from '@/lib/appointments';
import { getPatientInfo } from '@/lib/patients';
import { getPatientRecords, RecordFile } from '@/lib/records';

type PatientWithHistory = {
  patient: any;
  appointments: Appointment[];
  records: RecordFile[];
};

export default function DoctorPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientWithHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // 1. Fetch all appointments for doctor
      const apps = await getAppointmentsByDoctor(user.uid);

      // 2. Unique patient IDs
      const patientIds = [...new Set(apps.map((a) => a.patientId))];

      const data: PatientWithHistory[] = [];
      for (const pid of patientIds) {
        const patient = await getPatientInfo(pid);
        const patientApps = apps.filter((a) => a.patientId === pid);
        const recs = await getPatientRecords(pid);
        data.push({ patient, appointments: patientApps, records: recs });
      }

      setPatients(data);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">My Patients</h2>
      {loading && <p>Loading...</p>}
      {!loading && patients.length === 0 && <p>No patients yet.</p>}

      <div className="grid gap-4">
        {patients.map((p) => (
          <div key={p.patient.id} className="rounded border p-4 grid gap-3">
            <h3 className="text-lg font-semibold">
              {p.patient?.name || 'Unknown Patient'} ({p.patient?.email})
            </h3>

            <div>
              <h4 className="font-semibold">Appointments</h4>
              {p.appointments.map((a) => (
                <div key={a.id} className="border rounded p-2 mt-1">
                  <p><span className="font-semibold">Date:</span> {new Date(a.date).toLocaleString()}</p>
                  <p><span className="font-semibold">Reason:</span> {a.reason}</p>
                  <p><span className="font-semibold">Status:</span> {a.status}</p>
                  {a.notes && (
                    <p><span className="font-semibold">Notes:</span> {a.notes}</p>
                  )}
                </div>
              ))}
            </div>

            <div>
              <h4 className="font-semibold">Health Records</h4>
              {p.records.length === 0 && <p>No records uploaded.</p>}
              {p.records.map((r) => (
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
        ))}
      </div>
    </div>
  );
}
