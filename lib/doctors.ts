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
  fullName?: string;
  specialty: string;
  qualification?: string;
  experienceYears?: string;
  licenseNumber?: string;
  clinicAddress?: string;
  consultationFee?: string;
  phone?: string;
  email?: string;
  photoURL?: string;
  approved?: boolean;
  role?: string;
};

export type DoctorInfo = {
  id: string;
  uid: string;
  name: string;
  fullName: string;
  email: string;
  phone?: string;
  specialty: string;
  qualification?: string;
  experienceYears?: string;
  licenseNumber?: string;
  clinicAddress?: string;
  consultationFee?: string;
  photoURL?: string;
  approved: boolean;
};

export type Appointment = {
  id: string;
  doctorId: string;
  patientId: string;
  date: string;
  status?: string;
  notes?: string;
  attachments?: { fileName: string; fileUrl: string }[];
};

// Firestore schema (raw)
type DoctorDoc = {
  uid: string;
  name?: string;
  fullName?: string;
  specialty?: string;
  qualification?: string;
  experienceYears?: string;
  licenseNumber?: string;
  clinicAddress?: string;
  consultationFee?: string;
  phone?: string;
  email?: string;
  photoURL?: string;
  approved?: boolean;
  role?: string;
};

//
// ==== Firestore Queries ====

/** ✅ Get all approved doctors (for search/listing, favorites, etc.) */
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
      uid: data.uid || docSnap.id,
      name: data.name ?? data.fullName ?? "Unknown Doctor",
      fullName: data.fullName ?? data.name ?? "",
      specialty: data.specialty ?? "General",
      qualification: data.qualification ?? "",
      experienceYears: data.experienceYears ?? "",
      licenseNumber: data.licenseNumber ?? "",
      clinicAddress: data.clinicAddress ?? "",
      consultationFee: data.consultationFee ?? "",
      phone: data.phone ?? "",
      email: data.email ?? "",
      photoURL: data.photoURL ?? "",
      approved: data.approved ?? false,
      role: data.role ?? "doctor",
    };
  });
}

/** ✅ Get full info for one doctor (safe + complete) */
export async function getDoctorInfo(uid: string): Promise<DoctorInfo | null> {
  if (!uid) return null;

  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;

  const data = snap.data() as DoctorDoc;
  return {
    id: snap.id,
    uid: data.uid || snap.id,
    name: data.name ?? "Unknown",
    fullName: data.fullName ?? data.name ?? "Unknown Doctor",
    email: data.email ?? "",
    phone: data.phone ?? "",
    specialty: data.specialty ?? "General",
    qualification: data.qualification ?? "",
    experienceYears: data.experienceYears ?? "",
    licenseNumber: data.licenseNumber ?? "",
    clinicAddress: data.clinicAddress ?? "",
    consultationFee: data.consultationFee ?? "",
    photoURL: data.photoURL ?? "",
    approved: data.approved ?? false,
  };
}

/** ✅ Attach doctor names to appointment list for display */
export async function attachDoctorNames(
  apps: Appointment[]
): Promise<(Appointment & { doctorName: string })[]> {
  return Promise.all(
    apps.map(async (a: Appointment) => {
      try {
        const docInfo = await getDoctorInfo(a.doctorId);
        const doctorName = docInfo?.fullName || docInfo?.name || a.doctorId;

        return { ...a, doctorName };
      } catch {
        return { ...a, doctorName: a.doctorId };
      }
    })
  );
}
