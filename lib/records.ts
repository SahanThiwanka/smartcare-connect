"use client";
import { db, storage } from "./firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { getAuth } from "firebase/auth";

// ============ TYPES ============
export type RecordFile = {
  id?: string;
  patientId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: number;
  createdAt: number;
  storagePath?: string;
  uploadedBy?: string; // uploader UID
  uploadedByRole?: "doctor" | "patient"; // who uploaded it
};

// Firestore schema type
type RecordFileDoc = {
  patientId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: number;
  createdAt: number | { toMillis: () => number };
  storagePath?: string;
  uploadedBy?: string;
  uploadedByRole?: "doctor" | "patient";
};

// ============ FUNCTIONS ============

// 🩺 Upload Record (supports doctor & patient uploads)
export async function uploadRecord(patientId: string, file: File) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  // get uploader role from Firestore
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const uploaderData = userSnap.exists() ? userSnap.data() : {};
  const uploaderRole =
    (uploaderData?.role as "doctor" | "patient") || "patient";

  const timestamp = Date.now();
  const storagePath = `records/${patientId}/${timestamp}-${file.name}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);

  const record: Omit<RecordFile, "id"> = {
    patientId,
    fileName: file.name,
    fileUrl,
    uploadedAt: timestamp,
    createdAt: timestamp,
    storagePath,
    uploadedBy: user.uid,
    uploadedByRole: uploaderRole, // 👈 track who uploaded
  };

  const docRef = await addDoc(collection(db, "records"), record);
  return { id: docRef.id, ...record };
}

// 🩹 Get Records for a Patient (includes uploader info)
export async function getPatientRecords(
  patientId: string
): Promise<RecordFile[]> {
  const q = query(
    collection(db, "records"),
    where("patientId", "==", patientId)
  );
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as RecordFileDoc;

    return {
      id: d.id,
      patientId: data.patientId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      uploadedAt: data.uploadedAt,
      createdAt:
        typeof data.createdAt === "number"
          ? data.createdAt
          : data.createdAt.toMillis(),
      storagePath: data.storagePath,
      uploadedBy: data.uploadedBy,
      uploadedByRole: data.uploadedByRole,
    };
  });
}

// 🗑 Delete Record (from Firestore & Storage)
export async function deleteRecord(id: string, storagePath?: string) {
  await deleteDoc(doc(db, "records", id));
  if (storagePath) {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  }
}
