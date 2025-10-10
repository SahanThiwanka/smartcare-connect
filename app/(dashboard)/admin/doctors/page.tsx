"use client";
import { useEffect, useState } from "react";
import { getPendingDoctors, approveDoctor, rejectDoctor } from "@/lib/admin";
import type { DoctorInfo } from "@/lib/doctors";
import Image from "next/image";

export default function AdminDoctorsPage() {
  const [pending, setPending] = useState<DoctorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  const loadPending = async () => {
    setLoading(true);
    try {
      const docs = await getPendingDoctors();
      setPending(docs);
    } catch (err) {
      console.error("Failed to load pending doctors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleApprove = async (doc: DoctorInfo) => {
    if (!confirm("Approve this doctor?")) return;
    setProcessingUid(doc.uid);
    try {
      await approveDoctor(doc.uid);

      // 🔔 Send approval email
      await fetch("/api/notify-doctor-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: doc.email,
          name: doc.fullName || doc.name || "Doctor",
        }),
      });

      alert(`✅ Approved & notified: ${doc.fullName || doc.name}`);
      await loadPending();
    } catch (err) {
      console.error("Approve failed:", err);
      alert("Approve failed. Check console.");
    } finally {
      setProcessingUid(null);
    }
  };

  const handleReject = async (uid: string) => {
    if (!confirm("Reject this doctor?")) return;
    setProcessingUid(uid);
    try {
      await rejectDoctor(uid);
      await loadPending();
    } catch (err) {
      console.error("Reject failed:", err);
      alert("Reject failed. Check console.");
    } finally {
      setProcessingUid(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-semibold mb-2">Pending Doctor Approvals</h2>

      {loading && <p>Loading pending doctors...</p>}
      {!loading && pending.length === 0 && (
        <p className="text-gray-500">No pending doctors.</p>
      )}

      <div className="grid gap-4">
        {pending.map((doc) => (
          <div
            key={doc.uid}
            className="border rounded-lg bg-black p-4 shadow flex flex-col md:flex-row gap-4"
          >
            <div className="flex items-center justify-center">
              {doc.photoURL ? (
                <Image
                  src={doc.photoURL}
                  alt={doc.fullName || doc.name}
                  className="w-24 h-24 rounded-full object-cover border"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl">
                  👨‍⚕️
                </div>
              )}
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-bold">
                {doc.fullName ?? doc.name ?? "Unnamed Doctor"}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                <b>Specialty:</b> {doc.specialty || "Not provided"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                <p>
                  <b>Email:</b> {doc.email || "-"}
                </p>
                <p>
                  <b>Phone:</b> {doc.phone || "-"}
                </p>
                <p>
                  <b>Qualification:</b> {doc.qualification || "-"}
                </p>
                <p>
                  <b>Experience:</b> {doc.experienceYears || "-"}
                </p>
                <p>
                  <b>Clinic:</b> {doc.clinicAddress || "-"}
                </p>
                <p>
                  <b>Fee:</b> {doc.consultationFee || "-"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 justify-center">
              <button
                onClick={() => handleApprove(doc)}
                disabled={processingUid === doc.uid}
                className={`px-4 py-2 rounded text-white font-semibold ${
                  processingUid === doc.uid
                    ? "bg-gray-400"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {processingUid === doc.uid ? "Processing..." : "Approve"}
              </button>

              <button
                onClick={() => handleReject(doc.uid)}
                disabled={processingUid === doc.uid}
                className={`px-4 py-2 rounded text-white font-semibold ${
                  processingUid === doc.uid
                    ? "bg-gray-400"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {processingUid === doc.uid ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
