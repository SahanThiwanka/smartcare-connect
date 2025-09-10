"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

type ProfileForm = {
  // common
  fullName?: string;
  phone?: string;
  gender?: string;
  dob?: string;

  // patient
  height?: string;
  weight?: string;
  bloodGroup?: string;
  allergies?: string;
  medications?: string;
  emergencyContact?: string;
  address?: string;

  // doctor
  qualification?: string;
  specialty?: string;
  licenseNumber?: string;
  experienceYears?: string;
  clinicAddress?: string;
  consultationFee?: string;
};

export default function SetupProfilePage() {
  const { user, role } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<ProfileForm>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      return !!(form.fullName && form.phone && form.gender && form.dob);
    }
    if (step === 2 && role === "patient") {
      return !!(form.height && form.weight && form.bloodGroup);
    }
    if (step === 2 && role === "doctor") {
      return !!(form.qualification && form.specialty && form.licenseNumber);
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validateStep()) {
      setError("Please fill the required fields before saving.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build update object with ALL expected keys (so none are missing later)
      const base = {
        profileCompleted: true,
        fullName: form.fullName ?? "",
        phone: form.phone ?? "",
        gender: form.gender ?? "",
        dob: form.dob ?? "",
      };

      let updateData: Record<string, unknown> = { ...base };

      if (role === "patient") {
        updateData = {
          ...updateData,
          height: form.height ?? "",
          weight: form.weight ?? "",
          bloodGroup: form.bloodGroup ?? "",
          allergies: form.allergies ?? "",
          medications: form.medications ?? "",
          emergencyContact: form.emergencyContact ?? "",
          address: form.address ?? "",
        };
      } else if (role === "doctor") {
        updateData = {
          ...updateData,
          qualification: form.qualification ?? "",
          specialty: form.specialty ?? "",
          licenseNumber: form.licenseNumber ?? "",
          experienceYears: form.experienceYears ?? "",
          clinicAddress: form.clinicAddress ?? "",
          consultationFee: form.consultationFee ?? "",
        };
      }

      await updateDoc(doc(db, "users", user.uid), updateData);

      // go to profile (profile pages fetch fresh data)
      router.push(role === "doctor" ? "/doctor/profile" : "/patient/profile");
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center ">
      <div className="w-full max-w-lg rounded bg-black p-6 shadow">
        <h1 className="mb-4 text-2xl font-bold">
          Setup Profile ({role ?? "—"})
        </h1>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {/* Step 1 */}
        {step === 1 && (
          <div className="grid gap-4">
            <input
              name="fullName"
              placeholder="Full Name"
              value={form.fullName ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="phone"
              placeholder="Phone"
              value={form.phone ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <select
              name="gender"
              value={form.gender ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2 bg-black"
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <input
              name="dob"
              type="date"
              value={form.dob ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
          </div>
        )}

        {/* Step 2 - patient */}
        {step === 2 && role === "patient" && (
          <div className="grid gap-4">
            <input
              name="height"
              placeholder="Height (cm)"
              value={form.height ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="weight"
              placeholder="Weight (kg)"
              value={form.weight ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="bloodGroup"
              placeholder="Blood Group"
              value={form.bloodGroup ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="allergies"
              placeholder="Allergies"
              value={form.allergies ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="medications"
              placeholder="Current Medications"
              value={form.medications ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="emergencyContact"
              placeholder="Emergency Contact"
              value={form.emergencyContact ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="address"
              placeholder="Home Address"
              value={form.address ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
          </div>
        )}

        {/* Step 2 - doctor */}
        {step === 2 && role === "doctor" && (
          <div className="grid gap-4">
            <input
              name="qualification"
              placeholder="Highest Qualification"
              value={form.qualification ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="specialty"
              placeholder="Specialty / Major"
              value={form.specialty ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="licenseNumber"
              placeholder="License / Registration Number"
              value={form.licenseNumber ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="experienceYears"
              placeholder="Years of Experience"
              value={form.experienceYears ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="clinicAddress"
              placeholder="Clinic / Hospital Address"
              value={form.clinicAddress ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
            <input
              name="consultationFee"
              placeholder="Consultation Fee"
              value={form.consultationFee ?? ""}
              onChange={handleChange}
              className="w-full rounded border p-2"
            />
          </div>
        )}

        {/* navigation */}
        <div className="mt-6 flex justify-between">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="rounded bg-gray-600 px-4 py-2"
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
