'use client';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export type Patient = {
  uid: string;
  fullName?: string;
  email: string;
  phone?: string;
  dob?: string;
  bloodGroup?: string;
  allergies?: string;
  medications?: string;
};

export async function getPatientInfo(uid: string): Promise<Patient | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const data = snap.data() as Omit<Patient, 'uid'>;

  return {
    uid: snap.id, // ensure we always have the UID
    ...data,
  };
}
