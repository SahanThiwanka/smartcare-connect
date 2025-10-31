// app/(dashboard)/patient/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Syringe,
  ShieldAlert,
  Languages,
  Save,
  X,
  Pencil,
  HeartPulse,
  Ruler,
  Droplet,
  Stethoscope,
} from "lucide-react";

type PatientProfile = {
  fullName?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;

  // vitals
  bloodGroup?: string;
  height?: string; // cm
  weight?: string; // kg

  // medical
  allergies?: string;
  medications?: string;
  chronicConditions?: string[];
  otherCondition?: string;
  pastSurgeries?: string;

  // contact
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;

  // misc
  languages?: string[];
};

const CHRONIC_LIST = [
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
] as const;

const LANGUAGE_LIST = ["English", "Tamil", "Sinhala"] as const;
const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export default function PatientProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // fetch once
  useEffect(() => {
    if (!user?.uid) return;
    let mounted = true;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!mounted) return;

        const base: PatientProfile = {
          fullName: "",
          phone: "",
          dob: "",
          gender: "",
          maritalStatus: "",
          bloodGroup: "",
          height: "",
          weight: "",
          allergies: "",
          medications: "",
          chronicConditions: [],
          otherCondition: "",
          pastSurgeries: "",
          emergencyContactName: "",
          emergencyContactPhone: "",
          address: "",
          languages: [],
        };

        if (snap.exists()) {
          setForm({ ...base, ...(snap.data() as PatientProfile) });
        } else {
          setForm(base);
        }
      } catch {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const setField =
    (name: keyof PatientProfile) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => (prev ? { ...prev, [name]: e.target.value } : prev));
    };

  const toggleChip = (
    field: "chronicConditions" | "languages",
    value: string
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      const set = new Set(prev[field] ?? []);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      return { ...prev, [field]: Array.from(set) };
    });
  };

  const handleSave = async () => {
    if (!user?.uid || !form) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await updateDoc(doc(db, "users", user.uid), form);
      setEdit(false);
      setInfo("Profile updated successfully.");
    } catch {
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const empty = (v?: string) => (v && v.trim() ? v : "—");

  // BMI helper
  const bmi = (() => {
    const h = Number(form?.height || "");
    const w = Number(form?.weight || "");
    if (!h || !w) return null;
    const meters = h / 100;
    if (!meters) return null;
    const b = w / (meters * meters);
    return isFinite(b) ? b : null;
  })();

  const glass =
    "rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-md";

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-white/70">
        Loading profile...
      </div>
    );
  }
  if (!form) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-white/70">
        No profile found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white py-10 px-6">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <HeartPulse className="h-6 w-6 text-sky-300" />
              My Profile
            </h1>
            <p className="text-white/70">Manage your personal & medical info</p>
          </div>
          <div className="flex gap-2">
            {!edit ? (
              <button
                onClick={() => setEdit(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEdit(false)}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
            >
              {error}
            </motion.div>
          )}
          {info && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
            >
              {info}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic */}
          <Section title="Basic Information" icon={User}>
            {edit ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <LabeledInput
                  label="Full Name"
                  value={form.fullName ?? ""}
                  onChange={setField("fullName")}
                />
                <LabeledInput
                  label="Phone"
                  value={form.phone ?? ""}
                  onChange={setField("phone")}
                />
                <LabeledInput
                  label="Date of Birth"
                  type="date"
                  value={form.dob ?? ""}
                  onChange={setField("dob")}
                />
                <LabeledSelect
                  label="Gender"
                  value={form.gender ?? ""}
                  onChange={setField("gender")}
                  options={["male", "female", "other"]}
                />
                <LabeledSelect
                  label="Marital Status"
                  value={form.maritalStatus ?? ""}
                  onChange={setField("maritalStatus")}
                  options={["Married", "Unmarried"]}
                />
              </div>
            ) : (
              <ReadRows
                rows={[
                  ["Full Name", empty(form.fullName)],
                  ["Phone", empty(form.phone)],
                  ["Date of Birth", empty(form.dob)],
                  ["Gender", empty(form.gender)],
                  ["Marital Status", empty(form.maritalStatus)],
                ]}
              />
            )}
          </Section>

          {/* Vitals */}
          <Section title="Vitals" icon={Stethoscope}>
            {edit ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <LabeledSelect
                  label="Blood Group"
                  value={form.bloodGroup ?? ""}
                  onChange={setField("bloodGroup")}
                  options={[...BLOOD_GROUPS]}
                />
                <LabeledInput
                  label="Height (cm)"
                  value={form.height ?? ""}
                  onChange={setField("height")}
                  icon={<Ruler className="h-4 w-4 text-sky-300" />}
                />
                <LabeledInput
                  label="Weight (kg)"
                  value={form.weight ?? ""}
                  onChange={setField("weight")}
                  icon={<Droplet className="h-4 w-4 text-sky-300" />}
                />
              </div>
            ) : (
              <ReadRows
                rows={[
                  ["Blood Group", empty(form.bloodGroup)],
                  ["Height", form.height ? `${form.height} cm` : "—"],
                  ["Weight", form.weight ? `${form.weight} kg` : "—"],
                  ["BMI (calc.)", bmi ? bmi.toFixed(1) : "—"],
                ]}
              />
            )}
          </Section>

          {/* Medical */}
          <Section title="Medical Information" icon={Syringe}>
            {edit ? (
              <div className="grid gap-4">
                <LabeledInput
                  label="Allergies"
                  value={form.allergies ?? ""}
                  onChange={setField("allergies")}
                />
                <LabeledInput
                  label="Medications"
                  value={form.medications ?? ""}
                  onChange={setField("medications")}
                />
                <div>
                  <div className="text-sm text-white/70 mb-2">
                    Chronic Conditions
                  </div>
                  <Chips
                    options={CHRONIC_LIST}
                    selected={form.chronicConditions ?? []}
                    onToggle={(v) => toggleChip("chronicConditions", v)}
                  />
                </div>
                <LabeledInput
                  label="Other Condition (specify)"
                  value={form.otherCondition ?? ""}
                  onChange={setField("otherCondition")}
                />
              </div>
            ) : (
              <ReadRows
                rows={[
                  ["Allergies", empty(form.allergies)],
                  ["Medications", empty(form.medications)],
                  [
                    "Chronic Conditions",
                    form.chronicConditions?.length
                      ? form.chronicConditions.join(", ")
                      : "—",
                  ],
                  ["Other Condition", empty(form.otherCondition)],
                ]}
              />
            )}
          </Section>

          {/* Surgical History */}
          <Section title="Surgical History" icon={HeartPulse}>
            {edit ? (
              <LabeledInput
                label="Past Surgeries (if any)"
                value={form.pastSurgeries ?? ""}
                onChange={setField("pastSurgeries")}
              />
            ) : (
              <ReadRows
                rows={[["Past Surgeries", empty(form.pastSurgeries)]]}
              />
            )}
          </Section>

          {/* Emergency & Address */}
          <Section title="Emergency & Address" icon={ShieldAlert}>
            {edit ? (
              <div className="grid gap-4">
                <LabeledInput
                  label="Emergency Contact Name"
                  value={form.emergencyContactName ?? ""}
                  onChange={setField("emergencyContactName")}
                />
                <LabeledInput
                  label="Emergency Contact Phone"
                  value={form.emergencyContactPhone ?? ""}
                  onChange={setField("emergencyContactPhone")}
                />
                <LabeledInput
                  label="Home Address"
                  value={form.address ?? ""}
                  onChange={setField("address")}
                />
              </div>
            ) : (
              <ReadRows
                rows={[
                  [
                    "Emergency Contact",
                    form.emergencyContactName
                      ? `${form.emergencyContactName} (${
                          form.emergencyContactPhone || "—"
                        })`
                      : "—",
                  ],
                  ["Address", empty(form.address)],
                ]}
              />
            )}
          </Section>

          {/* Languages */}
          <Section title="Languages" icon={Languages}>
            {edit ? (
              <Chips
                options={LANGUAGE_LIST}
                selected={form.languages ?? []}
                onToggle={(v) => toggleChip("languages", v)}
              />
            ) : (
              <ReadRows
                rows={[["Languages Spoken", form.languages?.join(", ") || "—"]]}
              />
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Reusable UI ---------- */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-md p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-sky-300" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function ReadRows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-white/5 p-3">
          <div className="text-xs text-white/60">{label}</div>
          <div className="text-sm">{value}</div>
        </div>
      ))}
    </div>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              active
                ? "bg-sky-400 text-black hover:bg-sky-300"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: "text" | "date";
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
        {icon} {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-sky-500"
        placeholder={label}
      />
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <div>
      <div className="mb-1 text-sm text-white/70">{label}</div>
      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o} value={o}className="bg-gray-900 text-white">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
