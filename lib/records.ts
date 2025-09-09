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
  createdAt: number; // 👈 keep this as number (timestamp)
};

export async function uploadRecord(patientId: string, file: File) {
  const storageRef = ref(
    storage,
    `records/${patientId}/${Date.now()}-${file.name}`
  );
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const timestamp = Date.now();

  const record: RecordFile = {
    patientId,
    fileName: file.name,
    fileUrl: url,
    uploadedAt: timestamp,
    createdAt: timestamp, // 👈 save proper timestamp
  };

  const docRef = await addDoc(collection(db, "records"), record);
  return { id: docRef.id, ...record };
}

export async function getPatientRecords(patientId: string) {
  const q = query(
    collection(db, "records"),
    where("patientId", "==", patientId)
  );
  const snap = await getDocs(q);

  // Ensure createdAt is always a number
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      ...data,
      createdAt:
        typeof data.createdAt === "number"
          ? data.createdAt
          : data.createdAt?.toMillis?.() || Date.now(),
    } as RecordFile;
  });
}

export async function deleteRecord(id: string) {
  // delete from Firestore
  await deleteDoc(doc(db, "records", id));

  // optionally: delete from Storage (if you stored path)
  // but right now we only saved `fileUrl`, not `path`.
  // If you want storage delete, store the `path` in uploadRecord().
}
