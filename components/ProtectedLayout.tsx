"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

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

    // Not logged in
    if (!user) {
      router.replace("/login");
      return;
    }

    // Role not allowed
    if (role && !allowedRoles.includes(role)) {
      router.replace("/403");
      return;
    }

    // Incomplete profile (non-admin)
    if (role !== "admin" && !profileCompleted) {
      router.replace("/setup-profile");
      return;
    }

    // Doctor pending approval
    if (role === "doctor" && approved === false) {
      router.replace("/awaiting-approval");
      return;
    }

    // ✅ Access granted
    setAuthorized(true);
  }, [user, role, profileCompleted, approved, loading, router, allowedRoles]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-gray-400">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"
        />
        <p className="ml-3 text-sm">Checking access...</p>
      </div>
    );
  }

  if (!authorized) {
    // Avoid flicker during redirect
    return null;
  }

  return <>{children}</>;
}
