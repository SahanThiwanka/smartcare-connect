// app/(dashboard)/caregiver/profile/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  collection,
  documentId,
} from "firebase/firestore";
import { motion } from "framer-motion";
import { User, Users2, Clock4, Loader2, Check } from "lucide-react";

import {
  getIncomingRequests,
  getCaregiverPatients,
  getUser,
  type CaregiverRequest,
  type UserLite,
} from "@/lib/caregivers";

/* ---------------- Types ---------------- */
type CaregiverProfile = {
  fullName?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  languages?: string[];
  bio?: string;
  availability?: "available" | "busy" | "away";
  relationshipNotes?: string;
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

/* -------------- UI bits (unchanged) -------------- */
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-5 ${className}`}>
    {children}
  </div>
);

const Field = ({ label, hint, children, required }:{
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
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

/* -------------- Helpers -------------- */
async function getUsersByIds(ids: string[]): Promise<Record<string, Patient>> {
  const out: Record<string, Patient> = {};
  const unique = Array.from(new Set(ids)).filter(Boolean);
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await getDocs(query(collection(db, "users"), where(documentId(), "in", chunk)));
    snap.docs.forEach(d => {
      const raw = d.data() as Partial<Patient>;
      out[d.id] = {
        uid: d.id,
        fullName: raw.fullName ?? "",
        email: raw.email ?? "",
        phone: raw.phone ?? "",
      };
    });
  }
  return out;
}

/* -------------- Page -------------- */
export default function CaregiverProfilePage() {
  const { user, role, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(true);

  // Editable form
  const [form, setForm] = useState<CaregiverProfile>({});

  // Derived lists (now aligned with canonical schema)
  const [requests, setRequests] = useState<(CaregiverRequest & { patient?: UserLite | null })[]>([]);
  const [patients, setPatients] = useState<UserLite[]>([]);
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

  // Fetch pending requests + connected patients via canonical APIs
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // pending requests addressed to this caregiver
        const reqs = await getIncomingRequests(user.uid);
        const enriched = await Promise.all(
          reqs.map(async r => ({ ...r, patient: await getUser(r.patientId) }))
        );
        setRequests(enriched);

        // connected patients from caregiver's user doc array
        const pts = await getCaregiverPatients(user.uid);
        setPatients(pts);

        // preload minimal Patient map for quick labels
        const ids = [
          ...enriched.map(r => r.patientId),
          ...pts.map(p => p.uid),
        ];
        const map = await getUsersByIds(ids);
        setPatientInfo(map);
      } catch (e) {
        console.error(e);
        setRequests([]);
        setPatients([]);
        setPatientInfo({});
      }
    })();
  }, [user]);

  // Simple setters
  const setValue = useCallback(<K extends keyof CaregiverProfile>(key: K, value: CaregiverProfile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const toggleLang = (lang: string) => {
    setForm((f) => {
      const set = new Set(f.languages ?? []);
      if (set.has(lang)) set.delete(lang); else set.add(lang);
      return { ...f, languages: Array.from(set) };
    });
  };

  const canSave = useMemo(() => Boolean(form.fullName && form.phone), [form.fullName, form.phone]);

  async function handleSave() {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      // use setDoc(merge) so it works even if the doc doesn't exist yet
      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: form.fullName ?? "",
          phone: form.phone ?? "",
          gender: form.gender ?? "",
          dob: form.dob ?? "",
          bio: form.bio ?? "",
          relationshipNotes: form.relationshipNotes ?? "",
          availability: form.availability ?? "available",
          languages: Array.isArray(form.languages) ? form.languages : [],
          role: "caregiver",
          profileCompleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
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
          <p className="text-white/70 mt-1">Update your details and see patients who have connected with you.</p>
        </motion.div>

        {/* Profile form (unchanged UI) */}
        {/* ... keep your existing form JSX ... */}
        {/* Replace your original Card section with your existing form JSX and Save button */}
        {/* (omitted here for brevity—no structural changes besides handleSave) */}

        {/* Connections */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pending Requests (from caregiverRequests) */}
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
                    <div key={r.id ?? r.patientId} className="rounded-lg border border-white/10 bg-black/30 p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{info?.fullName || r.patient?.fullName || r.patientId}</div>
                        <div className="text-xs text-white/60">{info?.email || r.patient?.email || "—"}</div>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-200 text-xs">
                          {r.status ?? "pending"}
                        </span>
                        <a href="/caregiver/patients" className="text-xs rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10">
                          Review
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Connected Patients (from users.{caregiver}.patients[]) */}
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
                  const info = patientInfo[p.uid];
                  return (
                    <div key={p.uid} className="rounded-lg border border-white/10 bg-black/30 p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{info?.fullName || p.fullName || p.uid}</div>
                        <div className="text-xs text-white/60">{info?.email || p.email || "—"}</div>
                      </div>
                      <a href={`/caregiver/patients`} className="text-xs rounded border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10">
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
