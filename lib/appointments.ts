"use client";
import { db, storage } from "./firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";

// -------------------- Types --------------------
export type Appointment = {
  id?: string;
  patientId: string;
  doctorId: string;
  date: string;
  reason: string;
  status: "pending" | "approved" | "declined" | "completed";
  notes?: string;
  createdAt?: number;
  attachments?: {
    fileName: string;
    fileUrl: string;
    storagePath?: string;
    uploadedAt?: number;
  }[];
};

// -------------------- CRUD --------------------

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

// 👇 Allow patients to cancel pending appointments
export async function cancelAppointment(id: string) {
  await updateAppointmentStatus(id, "declined");
}

// -------------------- Attachments --------------------

/**
 * Adds a file attachment to an appointment.
 * (used when doctor uploads report or test result)
 */
export async function addAppointmentAttachment(
  appointmentId: string,
  attachment: {
    fileName: string;
    fileUrl: string;
    storagePath?: string;
    uploadedAt?: number;
  }
) {
  const ref = doc(db, "appointments", appointmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as Appointment;
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];
  attachments.push({
    ...attachment,
    uploadedAt: attachment.uploadedAt ?? Date.now(),
  });

  await updateDoc(ref, { attachments });
}

/**
 * Remove one attachment (and optionally delete its file in Storage)
 */
export async function removeAppointmentAttachment(
  appointmentId: string,
  fileUrl?: string,
  storagePath?: string
) {
  const ref = doc(db, "appointments", appointmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as Appointment;
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];

  const updated = attachments.filter((a) => {
    if (storagePath && a.storagePath) return a.storagePath !== storagePath;
    if (fileUrl && a.fileUrl) return a.fileUrl !== fileUrl;
    return true;
  });

  await updateDoc(ref, { attachments: updated });

  if (storagePath) {
    try {
      const sRef = storageRef(storage, storagePath);
      await deleteObject(sRef);
    } catch (err) {
      console.warn("⚠️ Failed to delete from storage:", err);
    }
  }
}
