"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

// 🔹 Define DoctorProfile type
type DoctorProfile = {
  fullName?: string;
  qualification?: string;
  specialty?: string;
  licenseNumber?: string;
  experienceYears?: string;
  clinicAddress?: string;
  consultationFee?: string;
  phone?: string;
};

export default function DoctorProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setForm(snap.data() as DoctorProfile);
      }
      setLoading(false);
    }
    fetchData();
  }, [user]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!form) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSave() {
    if (!user || !form) return;
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      fullName: form.fullName || "",
      qualification: form.qualification || "",
      specialty: form.specialty || "",
      licenseNumber: form.licenseNumber || "",
      experienceYears: form.experienceYears || "",
      clinicAddress: form.clinicAddress || "",
      consultationFee: form.consultationFee || "",
      phone: form.phone || "",
    });
    setEdit(false);
    alert("Profile updated!");
  }

  if (loading) return <p className="p-6">Loading...</p>;
  if (!form) return <p className="p-6">No profile found.</p>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-600 rounded shadow text-white">
      <h1 className="text-xl font-bold mb-4">Doctor Profile</h1>

      {edit ? (
        <div className="space-y-3">
          <input
            name="fullName"
            value={form.fullName || ""}
            onChange={handleChange}
            placeholder="Full Name"
            className="w-full border p-2 rounded text-black"
          />
          <input
            name="qualification"
            value={form.qualification || ""}
            onChange={handleChange}
            placeholder="Highest Qualification"
            className="w-full border p-2 rounded text-black"
          />
          <input
            name="specialty"
            value={form.specialty || ""}
            onChange={handleChange}
            placeholder="Specialty / Major"
            className="w-full border p-2 rounded text-black"
          />
          <input
            name="licenseNumber"
            value={form.licenseNumber || ""}
            onChange={handleChange}
            placeholder="License / Registration Number"
            className="w-full border p-2 rounded text-black"
          />
          <input
            name="experienceYears"
            value={form.experienceYears || ""}
            onChange={handleChange}
            placeholder="Years of Experience"
            className="w-full border p-2 rounded text-black"
          />
          <input
            name="clinicAddress"
            value={form.clinicAddress || ""}
            onChange={handleChange}
            placeholder="Clinic / Hospital Address"
            className="w-full border p-2 rounded text-black"
          />
          <input
            name="consultationFee"
            value={form.consultationFee || ""}
            onChange={handleChange}
            placeholder="Consultation Fee"
            className="w-full border p-2 rounded text-black"
          />
          <input
            name="phone"
            value={form.phone || ""}
            onChange={handleChange}
            placeholder="Phone"
            className="w-full border p-2 rounded text-black"
          />

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEdit(false)}
              className="bg-gray-500 hover:bg-gray-600 px-4 py-2 rounded text-white"
            >
              Cancel
            </button>
          </div>
        </div>
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
            <b>License:</b> {form.licenseNumber}
          </p>
          <p>
            <b>Experience:</b> {form.experienceYears} years
          </p>
          <p>
            <b>Clinic Address:</b> {form.clinicAddress}
          </p>
          <p>
            <b>Consultation Fee:</b> {form.consultationFee}
          </p>
          <p>
            <b>Phone:</b> {form.phone}
          </p>

          <button
            onClick={() => setEdit(true)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
