"use client";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  children: ReactNode;
  allowedRoles: string[];
};

export default function ProtectedLayout({ children, allowedRoles }: Props) {
  const { user, loading, role, profileCompleted, approved } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return; // wait for Firebase to finish

    // 1. not logged in
    if (!user) {
      router.replace("/login");
      return;
    }

    // 2. role not allowed
    if (role && !allowedRoles.includes(role)) {
      router.replace("/403");
      return;
    }

    // 3. profile not completed (for patient/doctor only)
    if (role !== "admin" && !profileCompleted) {
      router.replace("/setup-profile");
      return;
    }

    // 4. doctor waiting for approval
    if (role === "doctor" && approved === false) {
      router.replace("/awaiting-approval");
      return;
    }

    // ✅ All checks passed
    setAuthorized(true);
  }, [user, role, profileCompleted, approved, loading, router, allowedRoles]);

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  if (!authorized) {
    return null; // avoid flicker while redirecting
  }

  return <>{children}</>;
}
