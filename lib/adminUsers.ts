"use client";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  deleteDoc,
  orderBy,
  limit,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";

export type UserRole = "doctor" | "patient" | "admin";

export type BaseUser = {
  id: string; // Firestore doc id (usually uid)
  uid: string; // stored uid field
  email: string;
  role: UserRole;
  fullName?: string;
  phone?: string;
  createdAt?: number;
  // Doctor-only (optional)
  specialty?: string;
  qualification?: string;
  qualifications?: string;
  experienceYears?: string | number;
  licenseNumber?: string;
  clinicAddress?: string;
  consultationFee?: string;
  // Admin controls
  approved?: boolean; // doctors
  blocked?: boolean; // any user
};

// ✅ Strongly typed map function (no "any")
function mapDoc(d: QueryDocumentSnapshot<DocumentData>): BaseUser {
  const data = d.data() as Partial<BaseUser>;
  return {
    id: d.id,
    uid: (data.uid ?? d.id) as string,
    email: (data.email ?? "") as string,
    role: (data.role ?? "patient") as UserRole,
    fullName: data.fullName,
    phone: data.phone,
    createdAt: typeof data.createdAt === "number" ? data.createdAt : undefined,
    specialty: data.specialty,
    qualification: data.qualification,
    qualifications: data.qualifications,
    experienceYears: data.experienceYears,
    licenseNumber: data.licenseNumber,
    clinicAddress: data.clinicAddress,
    consultationFee: data.consultationFee,
    approved: data.approved,
    blocked: data.blocked,
  };
}

// Fetch doctors (approved or not)
export async function getDoctors(max: number = 200): Promise<BaseUser[]> {
  const q = query(
    collection(db, "users"),
    where("role", "==", "doctor"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
}

// Fetch patients
export async function getPatients(max: number = 200): Promise<BaseUser[]> {
  const q = query(
    collection(db, "users"),
    where("role", "==", "patient"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
}

// Fetch blocked users (any role)
export async function getBlockedUsers(max: number = 200): Promise<BaseUser[]> {
  const q = query(
    collection(db, "users"),
    where("blocked", "==", true),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
}

// Approve a doctor
export async function approveDoctor(uid: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { approved: true });
}

// Block / Unblock (blocked=true/false)
export async function setUserBlocked(
  uid: string,
  blocked: boolean
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { blocked });
}

// Remove user (Firestore doc)
export async function removeUser(uid: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid));
}
