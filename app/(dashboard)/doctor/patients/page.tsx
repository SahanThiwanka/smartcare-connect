"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByDoctor, Appointment } from "@/lib/appointments";
import { getPatientInfo } from "@/lib/patients";
import { getPatientRecords, RecordFile } from "@/lib/records";

type PatientWithHistory = {
  patient: any;
  appointments: Appointment[];
  records: RecordFile[];
};

export default function DoctorPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientWithHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const apps = await getAppointmentsByDoctor(user.uid);
        const patientIds = [...new Set(apps.map((a) => a.patientId))];

        const data: PatientWithHistory[] = [];
        for (const pid of patientIds) {
          try {
            const patient = await getPatientInfo(pid);
            const patientApps = apps.filter((a) => a.patientId === pid);
            const recs = await getPatientRecords(pid);
            if (patient) {
              data.push({ patient, appointments: patientApps, records: recs });
            }
          } catch (err) {
            console.error("Error loading patient", pid, err);
          }
        }

        setPatients(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // 🔍 Filter patients by name/email
  const filteredPatients = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.patient?.fullName?.toLowerCase().includes(q) ||
      p.patient?.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">My Patients</h2>

      {/* 🔍 Search */}
      <input
        type="text"
        placeholder="Search by name or email..."
        className="border rounded p-2 w-full max-w-md"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p>Loading...</p>}
      {!loading && filteredPatients.length === 0 && <p>No patients found.</p>}

      <div className="grid gap-4">
        {filteredPatients.map((p) => {
          const isOpen = expanded === p.patient.uid;
          return (
            <div key={p.patient.uid} className="rounded border p-4">
              {/* Patient Header */}
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : p.patient.uid)}
              >
                <h3 className="text-lg font-semibold">
                  {p.patient?.fullName || "Unnamed Patient"} ({p.patient?.email}
                  )
                </h3>
                <span className="text-sm text-gray-400">
                  {isOpen ? "▲ Hide" : "▼ Show"}
                </span>
              </div>

              {/* Expanded Details */}
              {isOpen && (
                <div className="mt-3 space-y-4">
                  {/* Patient Info */}
                  <div className="p-2 border rounded bg-gray-50 text-sm">
                    <p>
                      <b>Phone:</b> {p.patient?.phone || "N/A"}
                    </p>
                    <p>
                      <b>DOB:</b> {p.patient?.dob || "N/A"}
                    </p>
                    <p>
                      <b>Blood Group:</b> {p.patient?.bloodGroup || "N/A"}
                    </p>
                    <p>
                      <b>Allergies:</b> {p.patient?.allergies || "N/A"}
                    </p>
                    <p>
                      <b>Medications:</b> {p.patient?.medications || "N/A"}
                    </p>
                  </div>

                  {/* Appointments */}
                  <div>
                    <h4 className="font-semibold">Appointments</h4>
                    {p.appointments.map((a) => (
                      <div
                        key={a.id}
                        className="border rounded p-2 mt-1 text-sm"
                      >
                        <p>
                          <b>Date:</b> {new Date(a.date).toLocaleString()}
                        </p>
                        <p>
                          <b>Reason:</b> {a.reason}
                        </p>
                        <p>
                          <b>Status:</b> {a.status}
                        </p>
                        {a.notes && (
                          <p>
                            <b>Notes:</b> {a.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Health Records */}
                  <div>
                    <h4 className="font-semibold">Health Records</h4>
                    {p.records.length === 0 && <p>No records uploaded.</p>}
                    {p.records.map((r) => (
                      <a
                        key={r.id}
                        href={r.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-blue-600 hover:underline text-sm"
                      >
                        {r.fileName}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
