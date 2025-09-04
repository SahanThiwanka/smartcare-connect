import ProtectedLayout from "@/components/ProtectedLayout";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout allowedRoles={["doctor"]}>
      <div className="grid gap-6 py-6">
        <h1 className="text-2xl font-semibold">Doctor Dashboard</h1>
        {children}
      </div>
    </ProtectedLayout>
  );
}
