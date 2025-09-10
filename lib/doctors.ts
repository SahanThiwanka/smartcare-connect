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

//
// ==== Types ====
export type Doctor = {
  uid: string;
  name: string;
  specialty: string;
};

export type DoctorInfo = {
  id: string;
  uid: string;
  name: string;       // 👈 keep short name
  fullName: string;   // 👈 keep full name
  email: string;
  specialty: string;
  approved: boolean;
};

export type Appointment = {
  id: string;
  doctorId: string;
  patientId: string;
  date: string;
  // add other fields if needed
};

// Firestore schema for doctors (raw document shape)
type DoctorDoc = {
  uid: string;
  name?: string;
  fullName?: string;
  specialty?: string;
  email?: string;
  approved?: boolean;
  role?: string;
};

//
// ==== Firestore Queries ====
export async function getApprovedDoctors(): Promise<Doctor[]> {
  const q = query(
    collection(db, "users"),
    where("role", "==", "doctor"),
    where("approved", "==", true)
  );

  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as DoctorDoc;
    return {
      uid: data.uid,
      name: data.name ?? data.fullName ?? "Unknown Doctor",
      specialty: data.specialty ?? "General",
    };
  });
}

export async function getDoctorInfo(uid: string): Promise<DoctorInfo | null> {
  if (!uid) return null; // 👈 prevent invalid call

  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;

  const data = snap.data() as DoctorDoc;
  return {
    id: snap.id,
    uid: data.uid,
    name: data.name ?? "Unknown",          // fallback if missing
    fullName: data.fullName ?? data.name ?? "Unknown Doctor",
    email: data.email ?? "",
    specialty: data.specialty ?? "General",
    approved: data.approved ?? false,
  };
}

//
// ==== Example usage with appointments ====
export async function attachDoctorNames(
  apps: Appointment[]
): Promise<(Appointment & { doctorName: string })[]> {
  return Promise.all(
    apps.map(async (a: Appointment) => {
      try {
        const docInfo = await getDoctorInfo(a.doctorId);
        const doctorName =
          docInfo?.fullName || docInfo?.name || a.doctorId;

        return { ...a, doctorName };
      } catch {
        return { ...a, doctorName: a.doctorId };
      }
    })
  );
}
