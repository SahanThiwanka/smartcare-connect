"use client";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  DocumentData,
} from "firebase/firestore";

type Appointment = {
  status: "pending" | "approved" | "completed";
  [key: string]: unknown; // allow extra fields
};

export async function getAdminStats() {
  // Count patients
  const patientsSnap = await getDocs(
    query(collection(db, "users"), where("role", "==", "patient"))
  );
  const doctorsSnap = await getDocs(
    query(collection(db, "users"), where("role", "==", "doctor"))
  );

  const approvedDoctors = doctorsSnap.docs.filter(
    (d) => (d.data() as DocumentData).approved === true
  ).length;

  const pendingDoctors = doctorsSnap.docs.filter(
    (d) => (d.data() as DocumentData).approved !== true
  ).length;

  // Count appointments by status
  const appsSnap = await getDocs(collection(db, "appointments"));
  const apps: Appointment[] = appsSnap.docs.map((d) => d.data() as Appointment);

  const pendingApps = apps.filter((a) => a.status === "pending").length;
  const approvedApps = apps.filter((a) => a.status === "approved").length;
  const completedApps = apps.filter((a) => a.status === "completed").length;

  return {
    totalPatients: patientsSnap.size,
    totalDoctors: doctorsSnap.size,
    approvedDoctors,
    pendingDoctors,
    pendingApps,
    approvedApps,
    completedApps,
  };
}
