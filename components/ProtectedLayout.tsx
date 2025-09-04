"use client";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type Props = {
  children: ReactNode;
  allowedRoles: string[];
};

export default function ProtectedLayout({ children, allowedRoles }: Props) {
  const { user, loading, role } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      if (loading) return; // wait for Firebase auth to finish

      // not logged in
      if (!user) {
        router.replace("/login");
        return;
      }

      // role exists but not allowed
      if (role && !allowedRoles.includes(role)) {
        router.replace("/403");
        return;
      }

      // check profile completion (only for patient/doctor)
      if (role === "patient" || role === "doctor") {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (!data.profileCompleted) {
            router.replace("/setup-profile");
            return;
          }
        }
      }

      // if we passed all checks ✅
      setAuthorized(true);
    }

    checkAccess();
  }, [user, loading, role, router, allowedRoles]);

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  if (!authorized) {
    return null; // prevent flicker while redirecting
  }

  return <>{children}</>;
}
