"use client";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Protected({
  children,
  allow,
}: {
  children: ReactNode;
  allow: "patient" | "doctor" | 'admin';
}) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/");
      else if (role !== allow) router.replace("/");
    }
  }, [user, role, loading, router, allow]);

  if (loading || !user || role !== allow)
    return <div className="p-6">Loading...</div>;
  return <>{children}</>;
}
