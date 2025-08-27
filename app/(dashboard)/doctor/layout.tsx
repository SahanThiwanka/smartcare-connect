import Protected from '@/components/Protected';


export default function DoctorLayout({ children }: { children: React.ReactNode }) {
return (
<Protected allow="doctor">
<div className="grid gap-6 py-6">
<h1 className="text-2xl font-semibold">Doctor Dashboard</h1>
{children}
</div>
</Protected>
);
}