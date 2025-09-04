'use client';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function getPatientInfo(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
