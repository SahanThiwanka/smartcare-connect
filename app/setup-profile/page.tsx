"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

export default function SetupProfilePage() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) return <p className="p-6">Loading...</p>;

  // If admin somehow lands here → skip
  if (role === "admin") {
    router.replace("/admin");
    return null;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);

    if (!user || !user.uid) {
      setError("User not found. Please log in again.");
      return;
    }

    // Basic validation
    if (!form.fullName || !form.phone || !form.gender || !form.dob) {
      setError("Please fill out all required fields.");
      return;
    }

    if (role === "patient") {
      if (!form.height || !form.weight || !form.bloodGroup) {
        setError("Please complete patient details before submitting.");
        return;
      }
    }
    if (role === "doctor") {
      if (!form.qualification || !form.specialty || !form.licenseNumber) {
        setError("Please complete doctor details before submitting.");
        return;
      }
    }

    try {
      setLoading(true);

      // Clean form data
      const updateData: any = { profileCompleted: true };
      Object.keys(form).forEach((key) => {
        if (form[key] !== undefined && form[key] !== "") {
          updateData[key] = form[key];
        }
      });

      await updateDoc(doc(db, "users", user.uid), updateData);

      // Redirect by role
      if (role === "patient") {
        router.replace("/patient/profile");
      } else if (role === "doctor") {
        router.replace("/doctor/profile");
      } else {
        router.replace("/");
      }
    } catch (err: any) {
      setError("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white text-black shadow p-6 rounded">
      <h1 className="text-xl font-semibold mb-4">Complete Your Profile</h1>

      <form onSubmit={handleSubmit}>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {/* Step 1: Common fields */}
        {step === 1 && (
          <>
            <input
              name="fullName"
              placeholder="Full Name *"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="phone"
              placeholder="Phone *"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="gender"
              placeholder="Gender *"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="dob"
              type="date"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <button
              type="button"
              onClick={() => setStep(2)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Next
            </button>
          </>
        )}

        {/* Step 2: Patient fields */}
        {step === 2 && role === "patient" && (
          <>
            <input
              name="height"
              placeholder="Height (cm) *"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="weight"
              placeholder="Weight (kg) *"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="bloodGroup"
              placeholder="Blood Group *"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="allergies"
              placeholder="Allergies"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="medications"
              placeholder="Current Medications"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="emergencyContact"
              placeholder="Emergency Contact"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
            >
              {loading ? "Saving..." : "Finish"}
            </button>
          </>
        )}

        {/* Step 2: Doctor fields */}
        {step === 2 && role === "doctor" && (
          <>
            <input
              name="qualification"
              placeholder="Highest Qualification *"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="specialty"
              placeholder="Specialty / Major *"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="experienceYears"
              placeholder="Years of Experience"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="licenseNumber"
              placeholder="License / Registration Number *"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="clinicAddress"
              placeholder="Clinic / Hospital Address"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <input
              name="consultationFee"
              placeholder="Consultation Fee"
              className="mb-3 w-full border p-2 text-black"
              onChange={handleChange}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
            >
              {loading ? "Saving..." : "Finish"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
