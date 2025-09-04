"use client";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";

export type Doctor = {
  uid: string;
  name: string;
  specialty: string;
};

export type DoctorInfo = {
  id: string;
  uid: string;
  name: string;
  email: string;
  specialty: string;
  approved: boolean;
};
export async function getApprovedDoctors(): Promise<Doctor[]> {
  const q = query(
    collection(db, "users"),
    where("role", "==", "doctor"),
    where("approved", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => {
    const data = doc.data() as any;
    return {
      uid: data.uid,
      name: data.name || "Unknown Doctor",
      specialty: data.specialty || "General",
    };
  });
}

export async function getDoctorInfo(uid: string) {
  if (!uid) return null; // 👈 prevent invalid call
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return { id: snap.id, ...data };
}