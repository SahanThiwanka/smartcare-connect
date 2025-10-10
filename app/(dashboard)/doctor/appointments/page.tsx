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
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

type Attachment = {
  fileName: string;
  fileUrl: string;
};

export default function DoctorAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [patients, setPatients] = useState<Record<string, PatientInfo>>({});
  const [search, setSearch] = useState("");

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

  const handleFileChange = (
    appointmentId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    setFiles((prev) => ({ ...prev, [appointmentId]: selected }));
  };

  const uploadFiles = async (
    appointmentId: string,
    filesToUpload: File[]
  ): Promise<Attachment[]> => {
    const uploads: Attachment[] = [];
    for (const file of filesToUpload) {
      const fileRef = ref(
        storage,
        `appointments/${appointmentId}/${Date.now()}-${file.name}`
      );
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      uploads.push({ fileName: file.name, fileUrl: url });
    }
    return uploads;
  };

  const handleComplete = async (id: string) => {
    if (!notes[id]) return alert("Please enter notes before completing.");

    let attachments: Attachment[] = [];
    if (files[id] && files[id].length > 0) {
      attachments = await uploadFiles(id, files[id]);
    }

    await completeAppointment(id, notes[id]);
    await updateDoc(doc(db, "appointments", id), { attachments });

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "completed", notes: notes[id], attachments }
          : a
      )
    );

    setNotes((prev) => ({ ...prev, [id]: "" }));
    setFiles((prev) => ({ ...prev, [id]: [] }));
  };

  const handleApprove = async (id: string) => {
    await approveAppointment(id);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "approved" } : a))
    );
  };

  const handleDecline = async (id: string) => {
    await declineAppointment(id);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "declined" } : a))
    );
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

  // 🔍 Search filter
  const filteredAppointments = appointments.filter((a) => {
    const p = patients[a.patientId];
    const query = search.toLowerCase();
    return (
      p?.fullName?.toLowerCase().includes(query) ||
      a.reason.toLowerCase().includes(query) ||
      a.status.toLowerCase().includes(query) ||
      new Date(a.date).toLocaleString().toLowerCase().includes(query)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-semibold">Appointments</h2>

      {/* 🔍 Search */}
      <input
        type="text"
        placeholder="Search by name, reason, status, or date..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded p-2"
      />

      {loading && <p>Loading appointments...</p>}
      {!loading && filteredAppointments.length === 0 && (
        <p>No appointments found.</p>
      )}

      <div className="space-y-4">
        {filteredAppointments.map((a) => {
          const p = patients[a.patientId];
          return (
            <div key={a.id} className="rounded border p-4 shadow space-y-2">
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
                <p className="p-2 bg-gray-500 rounded">
                  <b>Notes:</b> {a.notes}
                </p>
              )}

              {/* 📎 Show Attachments */}
              {a.attachments && a.attachments.length > 0 && (
                <div className="p-2 border rounded bg-gray-500">
                  <b>Attachments:</b>
                  <ul className="list-disc pl-6">
                    {a.attachments.map((f) => (
                      <li key={f.fileUrl}>
                        <a
                          href={f.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {f.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pending or Approved Actions */}
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

                  {/* 📂 File Upload */}
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileChange(a.id!, e)}
                    className="border p-2 rounded"
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
