import ProtectedLayout from "@/components/ProtectedLayout";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout allowedRoles={["patient"]}>
      <div className="grid gap-6 py-6">
        <h1 className="text-2xl font-semibold">Patient Dashboard</h1>
        {children}
      </div>
    </ProtectedLayout>
  );
}
