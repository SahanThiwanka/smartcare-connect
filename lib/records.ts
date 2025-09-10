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
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

export type RecordFile = {
  id?: string;
  patientId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: number;
  createdAt: number; // keep as number (timestamp)
};

// Firestore schema type (raw document)
type RecordFileDoc = {
  patientId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: number;
  createdAt: number | { toMillis: () => number }; // Firestore Timestamp or number
};

export async function uploadRecord(patientId: string, file: File) {
  const storagePath = `records/${patientId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const timestamp = Date.now();

  const record: Omit<RecordFile, "id"> & { storagePath: string } = {
    patientId,
    fileName: file.name,
    fileUrl: url,
    uploadedAt: timestamp,
    createdAt: timestamp,
    storagePath, // 👈 store path so we can delete from Storage later
  };

  const docRef = await addDoc(collection(db, "records"), record);
  return { id: docRef.id, ...record };
}

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
    };
  });
}

export async function deleteRecord(id: string, storagePath?: string) {
  // delete from Firestore
  await deleteDoc(doc(db, "records", id));

  // delete from Storage if we have the path
  if (storagePath) {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  }
}
