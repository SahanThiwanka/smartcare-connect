"use client";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";

export type Appointment = {
  notes: any;
  id?: string;
  patientId: string;
  doctorId: string;
  date: string;
  reason: string;
  status: "pending" | "approved" | "declined" | "completed";
  createdAt: number;
};

export async function createAppointment(data: Appointment) {
  const ref = await addDoc(collection(db, "appointments"), data);
  return ref.id;
}

export async function getAppointmentsByPatient(patientId: string) {
  const q = query(
    collection(db, "appointments"),
    where("patientId", "==", patientId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Appointment) }));
}

export async function getAppointmentsByDoctor(doctorId: string) {
  const q = query(
    collection(db, "appointments"),
    where("doctorId", "==", doctorId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Appointment) }));
}

export async function updateAppointmentStatus(
  id: string,
  status: Appointment["status"]
) {
  await updateDoc(doc(db, "appointments", id), { status });
}

export async function approveAppointment(id: string) {
  await updateAppointmentStatus(id, "approved");
}

export async function declineAppointment(id: string) {
  await updateAppointmentStatus(id, "declined");
}

export async function completeAppointment(id: string, notes: string) {
  await updateDoc(doc(db, "appointments", id), {
    status: "completed",
    notes,
  });
}
