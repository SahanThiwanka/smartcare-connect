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

export async function getPendingDoctors() {
  const q = query(collection(db, "users"), where("role", "==", "doctor"));
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((doc: any) => doc.approved !== true); // 👈 treat missing field as not approved
}

export async function approveDoctor(uid: string) {
  await updateDoc(doc(db, "users", uid), { approved: true });
}

export async function rejectDoctor(uid: string) {
  await updateDoc(doc(db, "users", uid), { approved: false });
}
