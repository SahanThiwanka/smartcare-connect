import ProtectedLayout from "@/components/ProtectedLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout allowedRoles={["admin"]}>
      <div className="grid gap-6 py-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        {children}
      </div>
    </ProtectedLayout>
  );
}
