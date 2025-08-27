"use client";
import { db, storage } from "./firebase";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export type RecordFile = {
  id?: string;
  patientId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: number;
};

export async function uploadRecord(patientId: string, file: File) {
  const storageRef = ref(
    storage,
    `records/${patientId}/${Date.now()}-${file.name}`
  );
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const record: RecordFile = {
    patientId,
    fileName: file.name,
    fileUrl: url,
    uploadedAt: Date.now(),
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
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as RecordFile) }));
}
