// lib/dailyMeasures.ts
import { db } from "@/lib/firebase";
import { doc, setDoc, getDocs, collection, orderBy, query, Timestamp } from "firebase/firestore";

export type DailyMeasure = {
  date: string; // YYYY-MM-DD
  systolic?: number;
  diastolic?: number;
  sugarMgDl?: number;
  sugarPostMgDl?: number;
  cholesterolTotal?: number;
  spo2Pct?: number;
  exerciseMins?: number;
  temperatureC?: number;
  weightKg?: number;
  heightCm?: number;
  waterIntakeL?: number;
  // provenance
  addedBy: "patient" | "caregiver";
  caregiverId?: string;
  caregiverName?: string;
  createdAt?: Timestamp;
};

export async function upsertDailyMeasureForPatient(
  patientId: string,
  data: Omit<DailyMeasure, "createdAt">,
) {
  const ref = doc(db, "users", patientId, "dailyMeasures", data.date);
  await setDoc(ref, { ...data, createdAt: Timestamp.now() }, { merge: true });
}

export async function getDailyMeasures(patientId: string, limit: number = 30) {
  const q = query(
    collection(db, "users", patientId, "dailyMeasures"),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.slice(0, limit).map(d => d.data() as DailyMeasure);
}
