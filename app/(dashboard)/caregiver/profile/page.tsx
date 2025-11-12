// app/(dashboard)/caregiver/profile/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { motion } from "framer-motion";
import { User, Users2, Clock4, Loader2, Check, X } from "lucide-react";

/* ---------------- Types ---------------- */
type CaregiverProfile = {
  fullName?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  languages?: string[];      // ["English","Sinhala",...]
  bio?: string;              // short about
  availability?: "available" | "busy" | "away";
  relationshipNotes?: string; // general notes about how you support patients
};

type Patient = {
  uid: string;
  fullName?: string;
  email?: string;
  phone?: string;
};

type CaregiverLink = {
  patientId: string;
  status?: "pending" | "approved" | "rejected";
  createdAt?: any;
};

/* -------------- UI Helpers -------------- */
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-5 ${className}`}>
    {children}
  </div>
);

const Field = ({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm font-medium text-white/90">
      {label} {required && <span className="text-red-400">*</span>}
    </span>
    {children}
    {hint ? <span className="text-xs text-white/50">{hint}</span> : null}
  </label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 ${props.className ?? ""}`}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 ${props.className ?? ""}`}
  />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 ${props.className ?? ""}`}
  />
);

/* -------------- Page -------------- */
export default function CaregiverProfilePage() {
  const { user, role, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(true);

  // Editable form
  const [form, setForm] = useState<CaregiverProfile>({});
  // Derived lists
  const [patients, setPatients] = useState<CaregiverLink[]>([]);
  const [requests, setRequests] = useState<CaregiverLink[]>([]);
  const [patientInfo, setPatientInfo] = useState<Record<string, Patient>>({});

  const isCG = role === "caregiver";

  // Pull caregiver base profile (users/{uid})
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.exists() ? (snap.data() as Partial<CaregiverProfile>) : {};
      setForm({
        fullName: d.fullName ?? "",
        phone: d.phone ?? "",
        gender: d.gender ?? "",
        dob: d.dob ?? "",
        languages: Array.isArray(d.languages) ? d.languages : [],
        bio: d.bio ?? "",
        availability: (d.availability as CaregiverProfile["availability"]) ?? "available",
        relationshipNotes: d.relationshipNotes ?? "",
      });
      setBusy(false);
    });
    return () => unsub();
  }, [user]);

  // Pull my linked patients + requests
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Pending requests sent TO this caregiver
      const reqCol = collection(db, "caregivers", user.uid, "requests");
      const reqSnap = await getDocs(query(reqCol, orderBy("createdAt", "desc")));
      const reqs: CaregiverLink[] = reqSnap.docs.map((d) => ({
        patientId: String(d.id),
        ...(d.data() as Partial<CaregiverLink>),
        status: (d.data() as any)?.status ?? "pending",
      }));
      setRequests(reqs);

      // Approved patients
      const patCol = collection(db, "caregivers", user.uid, "patients");
      const patSnap = await getDocs(query(patCol, orderBy("createdAt", "desc")));
      const pts: CaregiverLink[] = patSnap.docs.map((d) => ({
        patientId: String(d.id),
        ...(d.data() as Partial<CaregiverLink>),
        status: "approved",
      }));
      setPatients(pts);

      // Preload minimal patient info
      const ids = Array.from(new Set([...reqs.map(r => r.patientId), ...pts.map(p => p.patientId)]));
      await Promise.all(ids.map(async (pid) => {
        const s = await getDoc(doc(db, "users", pid));
        const raw = s.exists() ? (s.data() as Partial<Patient>) : {};
        const p: Patient = {
          uid: pid,
          fullName: raw.fullName ?? "",
          email: raw.email ?? "",
          phone: raw.phone ?? "",
        };
        setPatientInfo((prev) => ({ ...prev, [pid]: p }));
      }));
    })();
  }, [user]);

  // Simple state setters
  const setValue = useCallback(<K extends keyof CaregiverProfile>(key: K, value: CaregiverProfile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const toggleLang = (lang: string) => {
    setForm((f) => {
      const set = new Set(f.languages ?? []);
      if (set.has(lang)) set.delete(lang);
      else set.add(lang);
      return { ...f, languages: Array.from(set) };
    });
  };

  const canSave = useMemo(() => {
    // Minimal required fields
    return Boolean(form.fullName && form.phone);
  }, [form.fullName, form.phone]);

  async function handleSave() {
    if (!user) return;
    if (!canSave) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        fullName: form.fullName ?? "",
        phone: form.phone ?? "",
        gender: form.gender ?? "",
        dob: form.dob ?? "",
        bio: form.bio ?? "",
        relationshipNotes: form.relationshipNotes ?? "",
        availability: form.availability ?? "available",
        languages: Array.isArray(form.languages) ? form.languages : [],
        // ensure role persists
        role: "caregiver",
        profileCompleted: true,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.error(e);
      alert("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || busy) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-white/70">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isCG) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Card>
          <p className="text-white/80">
            This page is for the <b>Caregiver</b> role. If this is a mistake, please log out and sign in with the correct role.
          </p>
        </Card>
      </div>
    );
  }

  const languagesAll = ["English", "Sinhala", "Tamil"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white py-10 px-5">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-7 w-7 text-blue-300" />
            Caregiver Profile
          </h1>
          <p className="text-white/70 mt-1">
            Update your details and see patients who have connected with you.
          </p>
        </motion.div>

        {/* Profile form */}
        <Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full Name" required>
              <Input
                placeholder="e.g., Nuwan Silva"
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

            <Field label="Gender">
              <Select
                value={form.gender ?? ""}
                onChange={(e) => setValue("gender", e.target.value)}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </Select>
            </Field>
            <Field label="Date of Birth">
              <Input
                type="date"
                value={form.dob ?? ""}
                onChange={(e) => setValue("dob", e.target.value)}
              />
            </Field>

            <div className="md:col-span-2 grid gap-3">
              <Field label="Languages">
                <div className="flex flex-wrap gap-3">
                  {languagesAll.map((l) => {
                    const checked = (form.languages ?? []).includes(l);
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => toggleLang(l)}
                        className={`px-3 py-1.5 rounded-lg border text-sm ${
                          checked
                            ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                            : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        {checked ? <Check className="inline h-3.5 w-3.5 mr-1" /> : null}
                        {l}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Availability" hint="Let patients know if you’re currently available.">
                <Select
                  value={form.availability ?? "available"}
                  onChange={(e) => setValue("availability", e.target.value as CaregiverProfile["availability"])}
                >
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="away">Away</option>
                </Select>
              </Field>

              <Field label="Short Bio">
                <Textarea
                  rows={3}
                  placeholder="Tell patients how you can help them day-to-day."
                  value={form.bio ?? ""}
                  onChange={(e) => setValue("bio", e.target.value)}
                />
              </Field>

              <Field label="Relationship / Care Notes">
                <Textarea
                  rows={3}
                  placeholder="General notes about the support you provide."
                  value={form.relationshipNotes ?? ""}
                  onChange={(e) => setValue("relationshipNotes", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Card>

        {/* Connections */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pending Requests */}
          <Card>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock4 className="h-5 w-5 text-yellow-300" />
              Pending Requests
            </h3>
            {requests.length === 0 ? (
              <p className="text-sm text-white/70">No pending requests.</p>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => {
                  const info = patientInfo[r.patientId];
                  return (
                    <div
                      key={r.patientId}
                      className="rounded-lg border border-white/10 bg-black/30 p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{info?.fullName || r.patientId}</div>
                        <div className="text-xs text-white/60">{info?.email || "—"}</div>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-200 text-xs">
                          {r.status ?? "pending"}
                        </span>
                        {/* Navigate to caregiver/patients page to approve/reject */}
                        <a
                          href="/caregiver/patients"
                          className="text-xs rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                        >
                          Review
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Approved Patients */}
          <Card>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users2 className="h-5 w-5 text-blue-300" />
              Connected Patients
            </h3>
            {patients.length === 0 ? (
              <p className="text-sm text-white/70">No patients connected yet.</p>
            ) : (
              <div className="space-y-2">
                {patients.map((p) => {
                  const info = patientInfo[p.patientId];
                  return (
                    <div
                      key={p.patientId}
                      className="rounded-lg border border-white/10 bg-black/30 p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{info?.fullName || p.patientId}</div>
                        <div className="text-xs text-white/60">{info?.email || "—"}</div>
                      </div>
                      <a
                        href={`/caregiver/patients`}
                        className="text-xs rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                      >
                        View
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
