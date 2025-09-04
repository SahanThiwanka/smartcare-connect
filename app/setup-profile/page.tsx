"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

export default function SetupProfilePage() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>({});

  if (!user) return <p>Loading...</p>;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit() {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      ...form,
      profileCompleted: true,
    });

    router.push(`/${role}`); // go to dashboard
  }

  return (
    <div className="max-w-lg mx-auto mt-10 bg-black shadow p-6 rounded">
      <h1 className="text-xl font-semibold mb-4">Complete Your Profile</h1>

      {step === 1 && (
        <>
          <input
            name="fullName"
            placeholder="Full Name"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="phone"
            placeholder="Phone"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="gender"
            placeholder="Gender"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="dob"
            type="date"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <button
            onClick={() => setStep(2)}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Next
          </button>
        </>
      )}

      {step === 2 && role === "patient" && (
        <>
          <input
            name="height"
            placeholder="Height (cm)"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="weight"
            placeholder="Weight (kg)"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="bloodGroup"
            placeholder="Blood Group"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="allergies"
            placeholder="Allergies"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="medications"
            placeholder="Current Medications"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="emergencyContact"
            placeholder="Emergency Contact"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <button
            onClick={handleSubmit}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Finish
          </button>
        </>
      )}

      {step === 2 && role === "doctor" && (
        <>
          <input
            name="qualification"
            placeholder="Highest Qualification"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="specialty"
            placeholder="Specialty / Major"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="experienceYears"
            placeholder="Years of Experience"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="licenseNumber"
            placeholder="License / Registration Number"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="clinicAddress"
            placeholder="Clinic / Hospital Address"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <input
            name="consultationFee"
            placeholder="Consultation Fee"
            className="mb-3 w-full border p-2"
            onChange={handleChange}
          />
          <button
            onClick={handleSubmit}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Finish
          </button>
        </>
      )}
    </div>
  );
}
