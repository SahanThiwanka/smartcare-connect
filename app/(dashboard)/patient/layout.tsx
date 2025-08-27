import Protected from "@/components/Protected";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Protected allow="patient">
      <div className="grid gap-6 py-6">
        <h1 className="text-2xl font-semibold">Patient Dashboard</h1>
        {children}
      </div>
    </Protected>
  );
}
