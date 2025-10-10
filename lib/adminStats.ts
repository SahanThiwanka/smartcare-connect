"use client";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

//
// ─── TYPE DEFINITIONS ───────────────────────────────────────────────
//

export interface AdminStats {
  totalPatients: number;
  totalDoctors: number;
  approvedDoctors: number;
  pendingDoctors: number;
  pendingApps: number;
  approvedApps: number;
  completedApps: number;
}

export interface AppointmentTrend {
  month: string;
  pending: number;
  approved: number;
  completed: number;
}

export interface UserGrowthTrend {
  month: string;
  doctors: number;
  patients: number;
}

//
// ─── REALTIME ADMIN STATS ──────────────────────────────────────────
//

export function subscribeAdminStats(callback: (stats: AdminStats) => void) {
  const usersRef = collection(db, "users");
  const appsRef = collection(db, "appointments");

  let currentStats: AdminStats = {
    totalPatients: 0,
    totalDoctors: 0,
    approvedDoctors: 0,
    pendingDoctors: 0,
    pendingApps: 0,
    approvedApps: 0,
    completedApps: 0,
  };

  const update = () => callback({ ...currentStats });

  const unsubUsers = onSnapshot(
    usersRef,
    (snap: QuerySnapshot<DocumentData>) => {
      const users = snap.docs.map((d) => d.data());
      const totalPatients = users.filter((u) => u.role === "patient").length;
      const totalDoctors = users.filter((u) => u.role === "doctor").length;
      const approvedDoctors = users.filter(
        (u) => u.role === "doctor" && u.approved
      ).length;
      const pendingDoctors = totalDoctors - approvedDoctors;

      currentStats = {
        ...currentStats,
        totalPatients,
        totalDoctors,
        approvedDoctors,
        pendingDoctors,
      };
      update();
    }
  );

  const unsubApps = onSnapshot(appsRef, (snap: QuerySnapshot<DocumentData>) => {
    const apps = snap.docs.map((d) => d.data());
    const pendingApps = apps.filter((a) => a.status === "pending").length;
    const approvedApps = apps.filter((a) => a.status === "approved").length;
    const completedApps = apps.filter((a) => a.status === "completed").length;

    currentStats = {
      ...currentStats,
      pendingApps,
      approvedApps,
      completedApps,
    };
    update();
  });

  return () => {
    unsubUsers();
    unsubApps();
  };
}

//
// ─── REALTIME APPOINTMENT TRENDS ───────────────────────────────────
//

export function subscribeAppointmentTrends(
  callback: (data: AppointmentTrend[]) => void
) {
  const q = query(
    collection(db, "appointments"),
    orderBy("createdAt", "asc"),
    limit(1000)
  );

  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const raw = snap.docs.map((d) => d.data());
    const monthly: Record<
      string,
      { pending: number; approved: number; completed: number }
    > = {};

    raw.forEach((a: DocumentData) => {
      if (!a.createdAt) return;
      const month = new Date(a.createdAt).toLocaleString("default", {
        month: "short",
      });
      if (!monthly[month])
        monthly[month] = { pending: 0, approved: 0, completed: 0 };
      if (a.status === "pending") monthly[month].pending++;
      if (a.status === "approved") monthly[month].approved++;
      if (a.status === "completed") monthly[month].completed++;
    });

    const result: AppointmentTrend[] = Object.entries(monthly).map(
      ([month, values]) => ({ month, ...values })
    );

    callback(result);
  });
}

//
// ─── REALTIME USER GROWTH ──────────────────────────────────────────
//

export function subscribeUserGrowth(
  callback: (data: UserGrowthTrend[]) => void
) {
  const q = query(
    collection(db, "users"),
    orderBy("createdAt", "asc"),
    limit(1000)
  );

  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const users = snap.docs.map((d) => d.data());
    const monthly: Record<string, { doctors: number; patients: number }> = {};

    users.forEach((u: DocumentData) => {
      if (!u.createdAt) return;
      const month = new Date(u.createdAt).toLocaleString("default", {
        month: "short",
      });
      if (!monthly[month]) monthly[month] = { doctors: 0, patients: 0 };
      if (u.role === "doctor") monthly[month].doctors++;
      if (u.role === "patient") monthly[month].patients++;
    });

    const result: UserGrowthTrend[] = Object.entries(monthly).map(
      ([month, values]) => ({ month, ...values })
    );

    callback(result);
  });
}
