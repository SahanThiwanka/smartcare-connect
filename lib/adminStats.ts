"use client";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

// ✅ Real-time Admin Stats
export function subscribeAdminStats(callback: (stats: any) => void) {
  const usersRef = collection(db, "users");
  const appsRef = collection(db, "appointments");

  let currentStats = {
    totalPatients: 0,
    totalDoctors: 0,
    approvedDoctors: 0,
    pendingDoctors: 0,
    pendingApps: 0,
    approvedApps: 0,
    completedApps: 0,
  };

  const update = () => callback({ ...currentStats });

  const unsubUsers = onSnapshot(usersRef, (snap) => {
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
  });

  const unsubApps = onSnapshot(appsRef, (snap) => {
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

// ✅ Real-time Appointment Trends (for chart)
export function subscribeAppointmentTrends(callback: (data: any[]) => void) {
  const q = query(
    collection(db, "appointments"),
    orderBy("createdAt", "asc"),
    limit(1000)
  );

  return onSnapshot(q, (snap) => {
    const raw = snap.docs.map((d) => d.data());
    const monthly: Record<
      string,
      { pending: number; approved: number; completed: number }
    > = {};

    raw.forEach((a: any) => {
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

    callback(
      Object.entries(monthly).map(([month, values]) => ({ month, ...values }))
    );
  });
}

// ✅ Real-time User Growth (for chart)
export function subscribeUserGrowth(callback: (data: any[]) => void) {
  const q = query(
    collection(db, "users"),
    orderBy("createdAt", "asc"),
    limit(1000)
  );

  return onSnapshot(q, (snap) => {
    const users = snap.docs.map((d) => d.data());
    const monthly: Record<string, { doctors: number; patients: number }> = {};

    users.forEach((u: any) => {
      if (!u.createdAt) return;
      const month = new Date(u.createdAt).toLocaleString("default", {
        month: "short",
      });
      if (!monthly[month]) monthly[month] = { doctors: 0, patients: 0 };
      if (u.role === "doctor") monthly[month].doctors++;
      if (u.role === "patient") monthly[month].patients++;
    });

    callback(
      Object.entries(monthly).map(([month, values]) => ({ month, ...values }))
    );
  });
}
