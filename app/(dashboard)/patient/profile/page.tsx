"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

interface PatientProfile {
  fullName?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  height?: string;
  weight?: string;
  allergies?: string;
  medications?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
  chronicConditions?: string[];
  otherCondition?: string;
  pastSurgeries?: string;
  languages?: string[];
}

export default function PatientProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!form) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCheckboxChange = (field: string, value: string) => {
    if (!form) return;
    const current = new Set(
      (form[field as keyof PatientProfile] as string[]) || []
    );
    if (current.has(value)) current.delete(value);
    else current.add(value);
    setForm({ ...form, [field]: Array.from(current) });
  };

  const handleSave = async () => {
    if (!user || !form) return;
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, "users", user.uid), { ...form });
      setEdit(false);
    } catch {
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (!form) return <p className="p-6">No profile found.</p>;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-black text-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {edit ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Basic Info */}
          <input
            name="fullName"
            placeholder="Full Name"
            value={form.fullName || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />
          <input
            name="phone"
            placeholder="Phone"
            value={form.phone || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />
          <select
            name="gender"
            value={form.gender || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white bg-black"
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
          <select
            name="maritalStatus"
            value={form.maritalStatus || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white bg-black"
          >
            <option value="">Marital Status</option>
            <option value="Married">Married</option>
            <option value="Unmarried">Unmarried</option>
          </select>
          <input
            name="dob"
            type="date"
            value={form.dob || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />

          {/* Medical Info */}
          <input
            name="height"
            placeholder="Height (cm)"
            value={form.height || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />
          <input
            name="weight"
            placeholder="Weight (kg)"
            value={form.weight || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />
          <select
            name="bloodGroup"
            value={form.bloodGroup || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white bg-black"
          >
            <option value="">Select Blood Group</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <input
            name="allergies"
            placeholder="Allergies"
            value={form.allergies || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />
          <input
            name="medications"
            placeholder="Medications"
            value={form.medications || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />

          {/* Emergency Contact */}
          <input
            name="emergencyContactName"
            placeholder="Emergency Contact Name"
            value={form.emergencyContactName || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />
          <input
            name="emergencyContactPhone"
            placeholder="Emergency Contact Phone"
            value={form.emergencyContactPhone || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />

          {/* Address */}
          <input
            name="address"
            placeholder="Home Address"
            value={form.address || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white"
          />

          {/* Chronic Medical Conditions */}
          <div className="col-span-2">
            <label className="font-semibold">Chronic Conditions</label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                "Cardiovascular diseases",
                "Diabetes",
                "Cancers",
                "Chronic respiratory diseases",
                "Neurological conditions",
                "Mental health disorders",
                "Arthritis",
                "Chronic kidney disease",
                "Obesity",
                "STD",
              ].map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.chronicConditions?.includes(c) || false}
                    onChange={() =>
                      handleCheckboxChange("chronicConditions", c)
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
            <input
              name="otherCondition"
              placeholder="Other (specify)"
              value={form.otherCondition || ""}
              onChange={handleChange}
              className="border p-2 rounded text-white mt-2"
            />
          </div>

          {/* Past Surgeries */}
          <input
            name="pastSurgeries"
            placeholder="Past Surgeries (if any)"
            value={form.pastSurgeries || ""}
            onChange={handleChange}
            className="border p-2 rounded text-white col-span-2"
          />

          {/* Languages */}
          <div className="col-span-2">
            <label className="font-semibold">Languages Spoken</label>
            <div className="flex gap-3">
              {["English", "Tamil", "Sinhala"].map((l) => (
                <label key={l} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.languages?.includes(l) || false}
                    onChange={() => handleCheckboxChange("languages", l)}
                  />
                  {l}
                </label>
              ))}
            </div>
          </div>
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
            <b>Gender:</b> {form.gender || "-"}
          </p>
          <p>
            <b>Marital Status:</b> {form.maritalStatus || "-"}
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
            <b>Emergency Contact:</b> {form.emergencyContactName || "-"} (
            {form.emergencyContactPhone || "-"})
          </p>
          <p>
            <b>Address:</b> {form.address || "-"}
          </p>
          <p>
            <b>Chronic Conditions:</b>{" "}
            {form.chronicConditions?.join(", ") || "-"}
          </p>
          <p>
            <b>Other Conditions:</b> {form.otherCondition || "-"}
          </p>
          <p>
            <b>Past Surgeries:</b> {form.pastSurgeries || "-"}
          </p>
          <p>
            <b>Languages:</b> {form.languages?.join(", ") || "-"}
          </p>
        </div>
      )}

      {/* Buttons */}
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
