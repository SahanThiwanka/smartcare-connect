"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

interface PatientProfile {
  fullName?: string;
  phone?: string;
  dob?: string;
  bloodGroup?: string;
  height?: string;
  weight?: string;
  allergies?: string;
  medications?: string;
  emergencyContact?: string;
  address?: string;
}

export default function PatientProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile on mount
  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setForm(snap.data() as PatientProfile);
        }
      } catch {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!form) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSave() {
    if (!user || !form) return;
    setSaving(true);
    setError(null);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { ...form }); // partial update
      setEdit(false);
    } catch {
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6">Loading...</p>;
  if (!form) return <p className="p-6">No profile found.</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-black text-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {edit ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries({
            fullName: "Full Name",
            phone: "Phone",
            dob: "Date of Birth",
            bloodGroup: "Blood Group",
            height: "Height (cm)",
            weight: "Weight (kg)",
            allergies: "Allergies",
            medications: "Current Medications",
            emergencyContact: "Emergency Contact",
            address: "Home Address",
          }).map(([key, placeholder]) => (
            <input
              key={key}
              name={key}
              type={key === "dob" ? "date" : "text"}
              value={form[key as keyof PatientProfile] || ""}
              onChange={handleChange}
              placeholder={placeholder}
              className="border p-2 rounded"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p>
            <b>Name:</b> {form.fullName || "-"}
          </p>
          <p>
            <b>Phone:</b> {form.phone || "-"}
          </p>
          <p>
            <b>DOB:</b> {form.dob || "-"}
          </p>
          <p>
            <b>Blood Group:</b> {form.bloodGroup || "-"}
          </p>
          <p>
            <b>Height:</b> {form.height || "-"} cm
          </p>
          <p>
            <b>Weight:</b> {form.weight || "-"} kg
          </p>
          <p>
            <b>Allergies:</b> {form.allergies || "-"}
          </p>
          <p>
            <b>Medications:</b> {form.medications || "-"}
          </p>
          <p>
            <b>Emergency Contact:</b> {form.emergencyContact || "-"}
          </p>
          <p>
            <b>Address:</b> {form.address || "-"}
          </p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {edit ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 px-4 py-2 rounded text-white"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEdit(false)}
              className="bg-gray-600 px-4 py-2 rounded text-white"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEdit(true)}
            className="bg-blue-600 px-4 py-2 rounded text-white"
          >
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
}
