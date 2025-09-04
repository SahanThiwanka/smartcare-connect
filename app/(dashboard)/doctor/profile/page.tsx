"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function DoctorProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setForm(snap.data());
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
    await updateDoc(doc(db, "users", user.uid), form);
    setEdit(false);
    alert("Profile updated!");
  }

  if (loading) return <p className="p-6">Loading...</p>;
  if (!form) return <p className="p-6">No profile found.</p>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-black rounded shadow">
      <h1 className="text-xl font-bold mb-4">Doctor Profile</h1>

      {edit ? (
        <>
          <input
            name="fullName"
            value={form.fullName || ""}
            onChange={handleChange}
            placeholder="Full Name"
            className="w-full border p-2 mb-3"
          />
          <input
            name="qualification"
            value={form.qualification || ""}
            onChange={handleChange}
            placeholder="Highest Qualification"
            className="w-full border p-2 mb-3"
          />
          <input
            name="specialty"
            value={form.specialty || ""}
            onChange={handleChange}
            placeholder="Specialty"
            className="w-full border p-2 mb-3"
          />
          <input
            name="consultationFee"
            value={form.consultationFee || ""}
            onChange={handleChange}
            placeholder="Consultation Fee"
            className="w-full border p-2 mb-3"
          />
          <button
            onClick={handleSave}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Save
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <p>
            <b>Name:</b> {form.fullName}
          </p>
          <p>
            <b>Qualification:</b> {form.qualification}
          </p>
          <p>
            <b>Specialty:</b> {form.specialty}
          </p>
          <p>
            <b>Consultation Fee:</b> {form.consultationFee}
          </p>
          <button
            onClick={() => setEdit(true)}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
