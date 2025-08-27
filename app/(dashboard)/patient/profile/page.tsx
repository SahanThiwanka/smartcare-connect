"use client";
import { useAuth } from "@/hooks/useAuth";

export default function PatientProfilePage() {
  const { user } = useAuth();
  return (
    <div className="grid gap-2">
      <h2 className="text-xl font-semibold">My Profile</h2>
      <p>Email: {user?.email}</p>
      <p>More patient fields coming soon…</p>
    </div>
  );
}
