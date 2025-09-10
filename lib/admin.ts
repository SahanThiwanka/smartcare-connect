"use client";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import type { DoctorInfo } from "./doctors"; // ✅ import type

export async function getPendingDoctors(): Promise<DoctorInfo[]> {
  const q = query(collection(db, "users"), where("role", "==", "doctor"));
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => {
      const data = d.data() as Omit<DoctorInfo, "id">;
      return { id: d.id, ...data };
    })
    .filter((doc) => doc.approved !== true); // ✅ no `any`
}

export async function approveDoctor(uid: string) {
  await updateDoc(doc(db, "users", uid), { approved: true });
}

export async function rejectDoctor(uid: string) {
  await updateDoc(doc(db, "users", uid), { approved: false });
}
