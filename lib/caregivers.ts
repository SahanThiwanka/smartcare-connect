// lib/caregivers.ts
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

export type UserLite = {
  uid: string;
  fullName?: string;
  email?: string;
  role?: "patient" | "doctor" | "caregiver";
  patients?: string[];
  caregivers?: string[];
};

export type CaregiverRequest = {
  id?: string;
  patientId: string;
  caregiverId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: Timestamp;
  decidedAt?: Timestamp;
  decidedBy?: string;
};

// Find caregivers by email prefix (simple search)
export async function searchCaregiversByEmailPrefix(prefix: string) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("role", "==", "caregiver"));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ uid: d.id, ...(d.data() as any) }))
    .filter(u =>
      String(u.email || "").toLowerCase().startsWith(prefix.toLowerCase())
    ) as UserLite[];
}

export async function getUser(uid: string): Promise<UserLite | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { uid: snap.id, ...(snap.data() as any) };
}

// Patient → send request
export async function sendCaregiverRequest(patientId: string, caregiverId: string) {
  const reqRef = collection(db, "caregiverRequests");
  await addDoc(reqRef, {
    patientId,
    caregiverId,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

// Caregiver → list incoming pending requests
export async function getIncomingRequests(caregiverId: string) {
  const reqRef = collection(db, "caregiverRequests");
  const q = query(reqRef, where("caregiverId", "==", caregiverId), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as CaregiverRequest[];
}

// Caregiver -> decide request
export async function decideCaregiverRequest(
  requestId: string,
  caregiverId: string,
  accept: boolean
) {
  const ref = doc(db, "caregiverRequests", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const req = snap.data() as CaregiverRequest;
  if (req.caregiverId !== caregiverId || req.status !== "pending") return;

  // Update request
  await updateDoc(ref, {
    status: accept ? "accepted" : "rejected",
    decidedAt: serverTimestamp(),
    decidedBy: caregiverId,
  });

  if (!accept) return;

  // Link caregiver → patients[]
  const careRef = doc(db, "users", caregiverId);
  const careSnap = await getDoc(careRef);
  if (careSnap.exists()) {
    const data = careSnap.data() as any;
    const current: string[] = Array.isArray(data.patients) ? data.patients : [];
    if (!current.includes(req.patientId)) {
      await updateDoc(careRef, { patients: [...current, req.patientId] });
    }
  }

  // (Optional) Link patient → caregivers[]
  const patRef = doc(db, "users", req.patientId);
  const patSnap = await getDoc(patRef);
  if (patSnap.exists()) {
    const data = patSnap.data() as any;
    const current: string[] = Array.isArray(data.caregivers) ? data.caregivers : [];
    if (!current.includes(caregiverId)) {
      await updateDoc(patRef, { caregivers: [...current, caregiverId] });
    }
  }
}

// Get caregiver’s assigned patients (lite)
export async function getCaregiverPatients(caregiverId: string) {
  const care = await getUser(caregiverId);
  const ids = care?.patients || [];
  const out: UserLite[] = [];
  for (const pid of ids) {
    const u = await getUser(pid);
    if (u) out.push(u);
  }
  return out;
}
