"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Stethoscope,
  MapPin,
  Phone,
  Edit3,
  Save,
  X,
  Award,
  Briefcase,
  Wallet,
  CheckCircle2,
} from "lucide-react";

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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) setForm(snap.data() as DoctorProfile);
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
    await updateDoc(userRef, form);
    setEdit(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading profile...
      </div>
    );

  if (!form)
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        No profile found.
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-gray-900 to-gray-800 text-white py-10 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Stethoscope className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold">Doctor Profile</h1>
              <p className="text-white/70 text-sm">
                Manage your professional details with ease.
              </p>
            </div>
          </div>

          {!edit && (
            <button
              onClick={() => setEdit(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              <Edit3 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>

        {/* Success toast */}
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Profile saved successfully!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Overview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-8 shadow-lg space-y-6"
        >
          <AnimatePresence mode="wait">
            {!edit ? (
              <motion.div
                key="view"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-3xl font-semibold">
                    {form.fullName?.charAt(0) || "D"}
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">
                      {form.fullName || "Unnamed Doctor"}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.specialty && (
                        <span className="px-3 py-1 text-xs bg-blue-600/30 border border-blue-500/40 rounded-full">
                          {form.specialty}
                        </span>
                      )}
                      {form.experienceYears && (
                        <span className="px-3 py-1 text-xs bg-green-600/30 border border-green-500/40 rounded-full">
                          {form.experienceYears} yrs experience
                        </span>
                      )}
                      {form.licenseNumber && (
                        <span className="px-3 py-1 text-xs bg-purple-600/30 border border-purple-500/40 rounded-full">
                          License verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 text-sm">
                  <ProfileInfo
                    icon={<User />}
                    label="Full Name"
                    value={form.fullName}
                  />
                  <ProfileInfo
                    icon={<Award />}
                    label="Qualification"
                    value={form.qualification}
                  />
                  <ProfileInfo
                    icon={<Briefcase />}
                    label="Specialty"
                    value={form.specialty}
                  />
                  <ProfileInfo
                    icon={<Wallet />}
                    label="Consultation Fee"
                    value={
                      form.consultationFee ? `$${form.consultationFee}` : "-"
                    }
                  />
                  <ProfileInfo
                    icon={<MapPin />}
                    label="Clinic Address"
                    value={form.clinicAddress}
                    fullWidth
                  />
                  <ProfileInfo
                    icon={<Phone />}
                    label="Phone"
                    value={form.phone}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {[
                  { name: "fullName", label: "Full Name" },
                  { name: "qualification", label: "Qualification" },
                  { name: "specialty", label: "Specialty" },
                  {
                    name: "licenseNumber",
                    label: "License / Registration No.",
                  },
                  { name: "experienceYears", label: "Years of Experience" },
                  { name: "clinicAddress", label: "Clinic Address" },
                  { name: "consultationFee", label: "Consultation Fee" },
                  { name: "phone", label: "Phone" },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm text-white/70 mb-1">
                      {field.label}
                    </label>
                    <input
                      name={field.name}
                      placeholder={field.label}
                      value={form[field.name as keyof DoctorProfile] || ""}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                  </div>
                ))}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition font-medium"
                  >
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button
                    onClick={() => setEdit(false)}
                    className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg transition font-medium"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

/* ----------------------------- Subcomponent ----------------------------- */

function ProfileInfo({
  icon,
  label,
  value,
  fullWidth,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 ${
        fullWidth ? "sm:col-span-2" : ""
      } bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition`}
    >
      <div className="text-blue-400">{icon}</div>
      <div>
        <div className="text-white/70 text-xs">{label}</div>
        <div className="text-sm font-medium text-white">{value || "-"}</div>
      </div>
    </div>
  );
}
