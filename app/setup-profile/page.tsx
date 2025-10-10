// app/setup-profile/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

type ProfileForm = {
  // Common
  fullName?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  maritalStatus?: string;

  // Patient-only
  height?: string;
  weight?: string;
  bloodGroup?: string;
  allergies?: string;
  medications?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
  chronicConditions?: string[];
  otherCondition?: string;
  pastSurgeries?: string;
  languages?: string[];

  // Doctor-only
  qualification?: string;
  specialty?: string;
  licenseNumber?: string;
  experienceYears?: string;
  clinicAddress?: string;
  consultationFee?: string;
};

const chronicList = [
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
];

const languageList = ["English", "Tamil", "Sinhala"];

// -------- UI helpers --------
const StepShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl ring-1 ring-white/10 p-5 sm:p-6">
    {children}
  </div>
);

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}> = ({ label, children, required, hint }) => (
  <label className="flex flex-col gap-2">
    <div className="text-sm font-medium text-white/90">
      {label} {required && <span className="text-red-400">*</span>}
    </div>
    {children}
    {hint ? <div className="text-xs text-white/50">{hint}</div> : null}
  </label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 ${
      props.className ?? ""
    }`}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 ${
      props.className ?? ""
    }`}
  />
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <h3 className="text-lg font-semibold text-white/90">{children}</h3>;

const StepTag: React.FC<{
  active?: boolean;
  done?: boolean;
  icon: string;
  label: string;
  step: number;
}> = ({ active, done, icon, label, step }) => (
  <div className="flex items-center gap-3">
    <div
      className={[
        "flex h-10 w-10 items-center justify-center rounded-full border transition",
        active
          ? "border-blue-400 text-blue-300 bg-blue-500/10 shadow-[0_0_20px_-5px] shadow-blue-500/60"
          : done
          ? "border-emerald-400 text-emerald-300 bg-emerald-500/10"
          : "border-white/15 text-white/60 bg-white/5",
      ].join(" ")}
    >
      <span className="text-lg">{icon}</span>
    </div>
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-white/50">
        Step {step}
      </span>
      <span className={`text-sm ${active ? "text-white" : "text-white/70"}`}>
        {label}
      </span>
    </div>
  </div>
);

// -------- Page --------
export default function SetupProfilePage() {
  const { user, role } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<ProfileForm>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPatient = role === "patient";
  const isDoctor = role === "doctor";

  // ---- validation per step ----
  const step1Valid = useMemo(
    () =>
      !!(
        form.fullName &&
        form.phone &&
        form.gender &&
        form.dob &&
        form.maritalStatus
      ),
    [form.fullName, form.phone, form.gender, form.dob, form.maritalStatus]
  );

  const step2Valid = useMemo(() => {
    if (isPatient) {
      return !!(form.height && form.weight && form.bloodGroup);
    }
    if (isDoctor) {
      return !!(form.qualification && form.specialty && form.licenseNumber);
    }
    return false;
  }, [
    isPatient,
    isDoctor,
    form.height,
    form.weight,
    form.bloodGroup,
    form.qualification,
    form.specialty,
    form.licenseNumber,
  ]);

  const progress = useMemo(
    () => (step === 1 ? 33 : step === 2 ? 66 : 100),
    [step]
  );

  function setValue<K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCheckboxArray(key: keyof ProfileForm, value: string) {
    setForm((prev) => {
      const set = new Set((prev[key] as string[]) ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });
  }

  async function handleSubmit() {
    if (!user) return;
    if (!(step1Valid && step2Valid)) {
      setError("Please complete all required fields.");
      return;
    }
    setError(null);
    setLoading(true);

    // Compose update payload
    const base = {
      profileCompleted: true,
      fullName: form.fullName ?? "",
      phone: form.phone ?? "",
      gender: form.gender ?? "",
      dob: form.dob ?? "",
      maritalStatus: form.maritalStatus ?? "",
    };

    let payload: Record<string, unknown> = { ...base };

    if (isPatient) {
      payload = {
        ...payload,
        height: form.height ?? "",
        weight: form.weight ?? "",
        bloodGroup: form.bloodGroup ?? "",
        allergies: form.allergies ?? "",
        medications: form.medications ?? "",
        emergencyContactName: form.emergencyContactName ?? "",
        emergencyContactPhone: form.emergencyContactPhone ?? "",
        address: form.address ?? "",
        chronicConditions: form.chronicConditions ?? [],
        otherCondition: form.otherCondition ?? "",
        pastSurgeries: form.pastSurgeries ?? "",
        languages: form.languages ?? [],
      };
    } else if (isDoctor) {
      payload = {
        ...payload,
        qualification: form.qualification ?? "",
        specialty: form.specialty ?? "",
        licenseNumber: form.licenseNumber ?? "",
        experienceYears: form.experienceYears ?? "",
        clinicAddress: form.clinicAddress ?? "",
        consultationFee: form.consultationFee ?? "",
      };
    }

    try {
      await updateDoc(doc(db, "users", user.uid), payload);
      router.push(isDoctor ? "/doctor/profile" : "/patient/profile");
    } catch (e) {
      console.error(e);
      setError("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // -------- Views --------
  const Step1 = (
    <StepShell>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name" required>
          <Input
            placeholder="e.g., Maya Perera"
            value={form.fullName ?? ""}
            onChange={(e) => setValue("fullName", e.target.value)}
          />
        </Field>
        <Field label="Phone" required>
          <Input
            placeholder="+94 7X XXX XXXX"
            value={form.phone ?? ""}
            onChange={(e) => setValue("phone", e.target.value)}
          />
        </Field>
        <Field label="Gender" required>
          <Select
            value={form.gender ?? ""}
            onChange={(e) => setValue("gender", e.target.value)}
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </Select>
        </Field>
        <Field label="Marital Status" required>
          <Select
            value={form.maritalStatus ?? ""}
            onChange={(e) => setValue("maritalStatus", e.target.value)}
          >
            <option value="">Select</option>
            <option value="Married">Married</option>
            <option value="Unmarried">Unmarried</option>
          </Select>
        </Field>
        <Field label="Date of Birth" required>
          <Input
            type="date"
            value={form.dob ?? ""}
            onChange={(e) => setValue("dob", e.target.value)}
          />
        </Field>
      </div>
    </StepShell>
  );

  const Step2Patient = (
    <StepShell>
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Height (cm)" required>
            <Input
              placeholder="e.g., 172"
              value={form.height ?? ""}
              onChange={(e) => setValue("height", e.target.value)}
            />
          </Field>
          <Field label="Weight (kg)" required>
            <Input
              placeholder="e.g., 68"
              value={form.weight ?? ""}
              onChange={(e) => setValue("weight", e.target.value)}
            />
          </Field>
          <Field label="Blood Group" required>
            <Select
              value={form.bloodGroup ?? ""}
              onChange={(e) => setValue("bloodGroup", e.target.value)}
            >
              <option value="">Select</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Allergies">
            <Input
              placeholder="e.g., Penicillin"
              value={form.allergies ?? ""}
              onChange={(e) => setValue("allergies", e.target.value)}
            />
          </Field>
          <Field label="Current Medications">
            <Input
              placeholder="e.g., Metformin"
              value={form.medications ?? ""}
              onChange={(e) => setValue("medications", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Emergency Contact Name">
            <Input
              placeholder="Name"
              value={form.emergencyContactName ?? ""}
              onChange={(e) => setValue("emergencyContactName", e.target.value)}
            />
          </Field>
          <Field label="Emergency Contact Phone">
            <Input
              placeholder="Phone"
              value={form.emergencyContactPhone ?? ""}
              onChange={(e) =>
                setValue("emergencyContactPhone", e.target.value)
              }
            />
          </Field>
        </div>

        <Field label="Home Address">
          <Input
            placeholder="Street, City"
            value={form.address ?? ""}
            onChange={(e) => setValue("address", e.target.value)}
          />
        </Field>

        <div className="grid gap-3">
          <SectionTitle>Chronic Medical Conditions</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {chronicList.map((c) => {
              const checked = (form.chronicConditions ?? []).includes(c);
              return (
                <label
                  key={c}
                  className="flex items-center gap-2 text-white/90"
                >
                  <input
                    type="checkbox"
                    className="accent-blue-400"
                    checked={checked}
                    onChange={() => toggleCheckboxArray("chronicConditions", c)}
                  />
                  {c}
                </label>
              );
            })}
          </div>
          <Input
            placeholder="Other (specify)"
            value={form.otherCondition ?? ""}
            onChange={(e) => setValue("otherCondition", e.target.value)}
          />
        </div>

        <Field label="Past Surgeries">
          <Input
            placeholder="e.g., Appendectomy in 2020"
            value={form.pastSurgeries ?? ""}
            onChange={(e) => setValue("pastSurgeries", e.target.value)}
          />
        </Field>

        <div className="grid gap-3">
          <SectionTitle>Languages Spoken</SectionTitle>
          <div className="flex flex-wrap gap-4">
            {languageList.map((l) => (
              <label key={l} className="flex items-center gap-2 text-white/90">
                <input
                  type="checkbox"
                  className="accent-blue-400"
                  checked={(form.languages ?? []).includes(l)}
                  onChange={() => toggleCheckboxArray("languages", l)}
                />
                {l}
              </label>
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  );

  const Step2Doctor = (
    <StepShell>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Highest Qualification" required>
          <Input
            placeholder="e.g., MBBS, MD"
            value={form.qualification ?? ""}
            onChange={(e) => setValue("qualification", e.target.value)}
          />
        </Field>
        <Field label="Specialty / Major" required>
          <Input
            placeholder="e.g., Cardiology"
            value={form.specialty ?? ""}
            onChange={(e) => setValue("specialty", e.target.value)}
          />
        </Field>
        <Field label="License / Registration Number" required>
          <Input
            placeholder="e.g., SLMC-12345"
            value={form.licenseNumber ?? ""}
            onChange={(e) => setValue("licenseNumber", e.target.value)}
          />
        </Field>
        <Field label="Years of Experience">
          <Input
            placeholder="e.g., 8"
            value={form.experienceYears ?? ""}
            onChange={(e) => setValue("experienceYears", e.target.value)}
          />
        </Field>
        <Field label="Clinic / Hospital Address">
          <Input
            placeholder="e.g., ABC Clinic, Colombo"
            value={form.clinicAddress ?? ""}
            onChange={(e) => setValue("clinicAddress", e.target.value)}
          />
        </Field>
        <Field label="Consultation Fee">
          <Input
            placeholder="e.g., 2000 LKR"
            value={form.consultationFee ?? ""}
            onChange={(e) => setValue("consultationFee", e.target.value)}
          />
        </Field>
      </div>
    </StepShell>
  );

  const Step3Review = (
    <StepShell>
      <div className="grid gap-6">
        <SectionTitle>Review & Confirm</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReviewRow label="Full Name" value={form.fullName} />
          <ReviewRow label="Phone" value={form.phone} />
          <ReviewRow label="Gender" value={form.gender} />
          <ReviewRow label="Marital Status" value={form.maritalStatus} />
          <ReviewRow label="Date of Birth" value={form.dob} />
        </div>

        {isPatient && (
          <>
            <SectionTitle>Patient Details</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <ReviewRow label="Height" value={form.height} />
              <ReviewRow label="Weight" value={form.weight} />
              <ReviewRow label="Blood Group" value={form.bloodGroup} />
              <ReviewRow label="Allergies" value={form.allergies} />
              <ReviewRow label="Medications" value={form.medications} />
              <ReviewRow
                label="Emergency Contact"
                value={`${form.emergencyContactName ?? ""} ${
                  form.emergencyContactPhone
                    ? "• " + form.emergencyContactPhone
                    : ""
                }`}
              />
              <ReviewRow label="Address" value={form.address} />
              <ReviewRow
                label="Chronic Conditions"
                value={
                  [
                    ...(form.chronicConditions ?? []),
                    ...(form.otherCondition ? [form.otherCondition] : []),
                  ].join(", ") || "-"
                }
              />
              <ReviewRow label="Past Surgeries" value={form.pastSurgeries} />
              <ReviewRow
                label="Languages"
                value={(form.languages ?? []).join(", ")}
              />
            </div>
          </>
        )}

        {isDoctor && (
          <>
            <SectionTitle>Doctor Details</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <ReviewRow label="Qualification" value={form.qualification} />
              <ReviewRow label="Specialty" value={form.specialty} />
              <ReviewRow label="License Number" value={form.licenseNumber} />
              <ReviewRow
                label="Experience (years)"
                value={form.experienceYears}
              />
              <ReviewRow label="Clinic Address" value={form.clinicAddress} />
              <ReviewRow
                label="Consultation Fee"
                value={form.consultationFee}
              />
            </div>
          </>
        )}
      </div>
    </StepShell>
  );

  return (
    <div className="min-h-[calc(100vh-64px)] py-10 px-4 bg-gradient-to-br from-black via-gray-900 to-gray-800">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Setup Profile {role ? `(${role})` : ""}
          </h1>
          <p className="text-white/60 mt-1">
            Just a few quick steps to get you ready.
          </p>
        </div>

        {/* Step Header */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 ring-1 ring-white/10">
          <div className="grid grid-cols-3 items-center gap-3">
            <StepTag
              icon="👤"
              label="Personal"
              step={1}
              active={step === 1}
              done={step > 1}
            />
            <StepTag
              icon={isPatient ? "❤️" : "🩺"}
              label={isPatient ? "Health" : "Professional"}
              step={2}
              active={step === 2}
              done={step > 2}
            />
            <StepTag
              icon="✅"
              label="Review"
              step={3}
              active={step === 3}
              done={false}
            />
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-2 bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">
            {error}
          </div>
        )}

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="mb-6"
            >
              {Step1}
            </motion.div>
          )}
          {step === 2 && isPatient && (
            <motion.div
              key="step2-patient"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="mb-6"
            >
              {Step2Patient}
            </motion.div>
          )}
          {step === 2 && isDoctor && (
            <motion.div
              key="step2-doctor"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="mb-6"
            >
              {Step2Doctor}
            </motion.div>
          )}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="mb-6"
            >
              {Step3Review}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setStep(step === 1 ? 1 : ((step - 1) as 1 | 2 | 3))}
            disabled={step === 1}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white/80 backdrop-blur-md hover:bg-white/10 disabled:opacity-40"
          >
            ← Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1 && !step1Valid) {
                  setError(
                    "Please complete all required fields in Personal Info."
                  );
                  return;
                }
                if (step === 2 && !step2Valid) {
                  setError(
                    isPatient
                      ? "Please complete Height, Weight, and Blood Group."
                      : "Please complete Qualification, Specialty, and License Number."
                  );
                  return;
                }
                setError(null);
                setStep((s) => (s + 1) as 1 | 2 | 3);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow hover:bg-blue-500"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Finish & Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-white/50">
        {label}
      </span>
      <span className="text-sm text-white/90">
        {value && value !== "" ? value : "-"}
      </span>
    </div>
  );
}
