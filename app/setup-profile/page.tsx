"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

// Common fields for both
type CommonProfile = {
  fullName: string;
  phone: string;
  gender: string;
  dob: string;
};

// Patient-specific
type PatientProfile = {
  height: string;
  weight: string;
  bloodGroup: string;
  allergies?: string;
  medications?: string;
  emergencyContact?: string;
};

// Doctor-specific
type DoctorProfile = {
  qualification: string;
  specialty: string;
  experienceYears?: string;
  licenseNumber: string;
  clinicAddress?: string;
  consultationFee?: string;
};

// Allow any combination, optional
type ProfileForm = Partial<CommonProfile & PatientProfile & DoctorProfile>;

export default function SetupProfilePage() {
  const { user, role } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<ProfileForm>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Validate fields based on step
  const validateStep = (): boolean => {
    if (step === 1) {
      return !!form.fullName && !!form.phone && !!form.gender && !!form.dob;
    }
    if (step === 2 && role === "patient") {
      return !!form.height && !!form.weight && !!form.bloodGroup;
    }
    if (step === 2 && role === "doctor") {
      return !!form.qualification && !!form.specialty && !!form.licenseNumber;
    }
    return true;
  };

  // Handle saving profile
  const handleSubmit = async () => {
    if (!user) return;
    if (!validateStep()) {
      setError("Please fill in all required fields.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updateData: Record<string, unknown> = { profileCompleted: true };

      Object.keys(form).forEach((key) => {
        const value = form[key as keyof ProfileForm];
        if (value !== undefined && value !== "") {
          updateData[key] = value;
        }
      });

      await updateDoc(doc(db, "users", user.uid), updateData);

      router.push(
        role === "doctor" ? "/doctor/dashboard" : "/patient/dashboard"
      );
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg rounded bg-white p-6 shadow">
        <h1 className="mb-4 text-2xl font-bold">Setup Profile ({role})</h1>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        {/* Step 1: Common Fields */}
        {step === 1 && (
          <div className="grid gap-4">
            <input
              name="fullName"
              placeholder="Full Name"
              value={form.fullName || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="phone"
              placeholder="Phone"
              value={form.phone || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <select
              name="gender"
              value={form.gender || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input
              name="dob"
              type="date"
              value={form.dob || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
          </div>
        )}

        {/* Step 2: Role-specific */}
        {step === 2 && role === "patient" && (
          <div className="grid gap-4">
            <input
              name="height"
              placeholder="Height"
              value={form.height || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="weight"
              placeholder="Weight"
              value={form.weight || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="bloodGroup"
              placeholder="Blood Group"
              value={form.bloodGroup || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
          </div>
        )}

        {step === 2 && role === "doctor" && (
          <div className="grid gap-4">
            <input
              name="qualification"
              placeholder="Qualification"
              value={form.qualification || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="specialty"
              placeholder="Specialty"
              value={form.specialty || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="licenseNumber"
              placeholder="License Number"
              value={form.licenseNumber || ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-6 flex justify-between">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="rounded bg-gray-200 px-4 py-2"
            >
              Back
            </button>
          )}
          {step < 2 && (
            <button
              onClick={() => {
                if (validateStep()) setStep(step + 1);
                else
                  setError(
                    "Please complete all required fields before continuing."
                  );
              }}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Next
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
