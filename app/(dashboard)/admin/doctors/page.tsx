"use client";
import { useEffect, useState } from "react";
import { getPendingDoctors, approveDoctor } from "@/lib/admin";
import type { DoctorInfo } from "@/lib/doctors"; // ✅ import correct type

export default function AdminDoctorsPage() {
  const [pending, setPending] = useState<DoctorInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPending = async () => {
    setLoading(true);
    const docs = await getPendingDoctors();
    setPending(docs);
    setLoading(false);
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleApprove = async (uid: string) => {
    await approveDoctor(uid);
    loadPending();
  };

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">Pending Doctors</h2>

      {loading && <p>Loading...</p>}
      {pending.length === 0 && !loading && <p>No pending doctors.</p>}

      {pending.map((doc) => (
        <div
          key={doc.uid}
          className="rounded border p-3 flex justify-between items-center"
        >
          <div>
            <p>
              <span className="font-semibold">Name:</span> {doc.name}
            </p>
            <p>
              <span className="font-semibold">Specialty:</span>{" "}
              {doc.specialty}
            </p>
            <p>
              <span className="font-semibold">Email:</span> {doc.email}
            </p>
          </div>
          <button
            onClick={() => handleApprove(doc.uid)}
            className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
          >
            Approve
          </button>
        </div>
      ))}
    </div>
  );
}
