"use client";
import { db } from "./firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export type Doctor = {
  uid: string;
  name: string;
  specialty: string;
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
