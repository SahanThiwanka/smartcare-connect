import Protected from "@/components/Protected";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Protected allow="admin">
      <div className="grid gap-6 py-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        {children}
      </div>
    </Protected>
  );
}
