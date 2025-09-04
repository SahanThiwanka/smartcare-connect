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
      <h1 className="text-xl font-bold mb-4">My Profile</h1>

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
            name="phone"
            value={form.phone || ""}
            onChange={handleChange}
            placeholder="Phone"
            className="w-full border p-2 mb-3"
          />
          <input
            name="dob"
            type="date"
            value={form.dob || ""}
            onChange={handleChange}
            className="w-full border p-2 mb-3"
          />
          <input
            name="bloodGroup"
            value={form.bloodGroup || ""}
            onChange={handleChange}
            placeholder="Blood Group"
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
            <b>Phone:</b> {form.phone}
          </p>
          <p>
            <b>DOB:</b> {form.dob}
          </p>
          <p>
            <b>Blood Group:</b> {form.bloodGroup}
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
