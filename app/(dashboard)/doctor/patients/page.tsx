"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppointmentsByDoctor, Appointment } from "@/lib/appointments";
import { getPatientInfo } from "@/lib/patients";
import { getPatientRecords, RecordFile } from "@/lib/records";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type DailyMeasure = {
  date: string;
  pressure?: string;
  cholesterol?: string;
  sugar?: string;
  spo2?: string;
  exerciseTime?: string;
  temperature?: string;
  weight?: string;
};

type Patient = {
  uid: string;
  fullName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  bloodGroup?: string;
  allergies?: string;
  medications?: string;
};

type Attachment = {
  fileName: string;
  fileUrl: string;
};

type PatientWithHistory = {
  patient: Patient;
  appointments: Appointment[];
  records: RecordFile[];
};

export default function DoctorPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientWithHistory[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dailyMeasures, setDailyMeasures] = useState<
    Record<string, DailyMeasure[]>
  >({});

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
              data.push({
                patient: patient as Patient,
                appointments: patientApps,
                records: recs,
              });
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

  async function fetchDailyMeasures(pid: string) {
    try {
      const q = query(
        collection(db, "users", pid, "dailyMeasures"),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => d.data() as DailyMeasure);
      setDailyMeasures((prev) => ({ ...prev, [pid]: data }));
    } catch (err) {
      console.error("Failed to fetch daily measures", err);
      setDailyMeasures((prev) => ({ ...prev, [pid]: [] }));
    }
  }

  const filteredPatients = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.patient?.fullName?.toLowerCase().includes(q) ||
      p.patient?.email?.toLowerCase().includes(q)
    );
  });

  // ✅ Simple, safe PDF generation (text-only, no plugin needed)
  async function generatePdfForPatient(
    pid: string,
    patient: Patient,
    appointments: Appointment[],
    records: RecordFile[]
  ) {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("SmartCare Connect - Patient Report", 10, 15);

      doc.setFontSize(12);
      doc.text(`Name: ${patient.fullName || "-"}`, 10, 30);
      doc.text(`Email: ${patient.email || "-"}`, 10, 38);
      doc.text(`Phone: ${patient.phone || "-"}`, 10, 46);
      doc.text(`DOB: ${patient.dob || "-"}`, 10, 54);
      doc.text(`Blood Group: ${patient.bloodGroup || "-"}`, 10, 62);

      let y = 75;
      doc.setFontSize(14);
      doc.text("Appointments", 10, y);
      y += 6;

      doc.setFontSize(10);
      if (appointments.length === 0) {
        doc.text("No appointments found.", 10, y);
      } else {
        for (const a of appointments) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(
            `${new Date(a.date).toLocaleDateString()} | ${a.reason || "-"} | ${
              a.status
            }`,
            10,
            y
          );
          y += 6;
          if (a.notes) {
            doc.text(`Notes: ${a.notes}`, 14, y);
            y += 6;
          }

          // ✅ Include doctor attachments
          if (a.attachments && a.attachments.length > 0) {
            doc.text("Attachments:", 14, y);
            y += 6;
            for (const file of a.attachments as Attachment[]) {
              doc.text(`- ${file.fileName}`, 18, y);
              y += 6;
            }
          }
        }
      }

      y += 10;
      doc.setFontSize(14);
      doc.text("Health Records", 10, y);
      y += 6;
      doc.setFontSize(10);
      if (records.length === 0) {
        doc.text("No records uploaded.", 10, y);
      } else {
        for (const r of records) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(`- ${r.fileName}`, 10, y);
          y += 6;
        }
      }

      doc.save(`${patient.fullName || pid}_report.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  }

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">My Patients</h2>

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
          const measures = dailyMeasures[p.patient.uid] || [];

          return (
            <div key={p.patient.uid} className="rounded border p-4 bg-gray-700">
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => {
                  setExpanded(isOpen ? null : p.patient.uid);
                  if (!isOpen) fetchDailyMeasures(p.patient.uid);
                }}
              >
                <h3 className="text-lg font-semibold">
                  {p.patient?.fullName || "Unnamed Patient"} ({p.patient?.email}
                  )
                </h3>
                <span className="text-sm text-gray-500">
                  {isOpen ? "▲ Hide" : "▼ Show"}
                </span>
              </div>

              {isOpen && (
                <div className="mt-4 space-y-4">
                  {/* Patient Info */}
                  <div className="p-3 border rounded bg-gray-500 text-sm">
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
                    <h4 className="font-semibold mb-1">Appointments</h4>
                    {p.appointments.length === 0 ? (
                      <p>No appointments found.</p>
                    ) : (
                      p.appointments.map((a) => (
                        <div
                          key={a.id}
                          className="border rounded p-2 mt-1 text-sm bg-gray-500"
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

                          {/* ✅ Doctor Attachments */}
                          {a.attachments && a.attachments.length > 0 && (
                            <div className="mt-2">
                              <b>Attachments:</b>
                              <ul className="list-disc pl-6">
                                {(a.attachments as Attachment[]).map((file) => (
                                  <li key={file.fileUrl}>
                                    <a
                                      href={file.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      {file.fileName}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Health Records */}
                  <div>
                    <h4 className="font-semibold mb-1">Health Records</h4>
                    {p.records.length === 0 ? (
                      <p>No records uploaded.</p>
                    ) : (
                      p.records.map((r) => (
                        <a
                          key={r.id}
                          href={r.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 hover:underline text-sm"
                        >
                          {r.fileName}
                        </a>
                      ))
                    )}
                  </div>

                  {/* Daily Measures */}
                  <div>
                    <h4 className="font-semibold mb-2">Daily Measurements</h4>
                    {measures.length === 0 ? (
                      <p>No data available.</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-2 bg-gray-500 rounded text-sm">
                          <b>Latest:</b> {measures[0].date}
                        </div>
                        <div style={{ width: "100%", height: 200 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={measures.slice().reverse()}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="pressure"
                                stroke="#1E90FF"
                                name="Pressure"
                              />
                              <Line
                                type="monotone"
                                dataKey="sugar"
                                stroke="#FF6347"
                                name="Sugar"
                              />
                              <Line
                                type="monotone"
                                dataKey="weight"
                                stroke="#32CD32"
                                name="Weight"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Download PDF */}
                  <button
                    onClick={() =>
                      generatePdfForPatient(
                        p.patient.uid,
                        p.patient,
                        p.appointments,
                        p.records
                      )
                    }
                    className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                  >
                    Download Patient Report (PDF)
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
