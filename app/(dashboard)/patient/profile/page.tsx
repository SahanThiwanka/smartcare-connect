"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function PatientProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState<any>(null);
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
          setForm(snap.data());
        }
      } catch (err: any) {
        setError("Failed to load profile.");
      }
      setLoading(false);
    }
    fetchData();
  }, [user]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { ...form }); // partial update
      setEdit(false);
    } catch (err: any) {
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
          <input
            name="fullName"
            value={form.fullName || ""}
            onChange={handleChange}
            placeholder="Full Name"
            className="border p-2 rounded"
          />
          <input
            name="phone"
            value={form.phone || ""}
            onChange={handleChange}
            placeholder="Phone"
            className="border p-2 rounded"
          />
          <input
            name="dob"
            type="date"
            value={form.dob || ""}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <input
            name="bloodGroup"
            value={form.bloodGroup || ""}
            onChange={handleChange}
            placeholder="Blood Group"
            className="border p-2 rounded"
          />
          <input
            name="height"
            value={form.height || ""}
            onChange={handleChange}
            placeholder="Height (cm)"
            className="border p-2 rounded"
          />
          <input
            name="weight"
            value={form.weight || ""}
            onChange={handleChange}
            placeholder="Weight (kg)"
            className="border p-2 rounded"
          />
          <input
            name="allergies"
            value={form.allergies || ""}
            onChange={handleChange}
            placeholder="Allergies"
            className="border p-2 rounded"
          />
          <input
            name="medications"
            value={form.medications || ""}
            onChange={handleChange}
            placeholder="Current Medications"
            className="border p-2 rounded"
          />
          <input
            name="emergencyContact"
            value={form.emergencyContact || ""}
            onChange={handleChange}
            placeholder="Emergency Contact"
            className="border p-2 rounded"
          />
          <input
            name="address"
            value={form.address || ""}
            onChange={handleChange}
            placeholder="Home Address"
            className="border p-2 rounded"
          />
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
