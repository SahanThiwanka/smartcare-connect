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
import type { DoctorInfo } from "./doctors";

/** ✅ Get all doctors that are not yet approved */
export async function getPendingDoctors(): Promise<DoctorInfo[]> {
  const q = query(
    collection(db, "users"),
    where("role", "==", "doctor"),
    where("approved", "==", false)
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as Partial<DoctorInfo>;

    return {
      id: d.id,
      uid: data.uid || d.id,
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
    } satisfies DoctorInfo;
  });
}

/** ✅ Approve doctor by UID */
export async function approveDoctor(uid: string) {
  await updateDoc(doc(db, "users", uid), { approved: true });
}

/** ✅ Reject (or unapprove) doctor by UID */
export async function rejectDoctor(uid: string) {
  await updateDoc(doc(db, "users", uid), { approved: false });
}
