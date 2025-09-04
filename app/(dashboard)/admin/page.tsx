'use client';
import { useEffect, useState } from 'react';
import { getAdminStats } from '@/lib/adminStats';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await getAdminStats();
      setStats(s);
      setLoading(false);
    })();
  }, []);

  return (
    <ProtectedLayout allowedRoles={['admin']}>
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">Admin Dashboard</h2>
      {loading && <p>Loading stats...</p>}

      {stats && (
        <div className="grid gap-4">
          {/* Users */}
          <div className="rounded border p-4">
            <h3 className="font-semibold">Users</h3>
            <p>Total Patients: {stats.totalPatients}</p>
            <p>Total Doctors: {stats.totalDoctors}</p>
            <p>Approved Doctors: {stats.approvedDoctors}</p>
            <p>Pending Doctors: {stats.pendingDoctors}</p>
          </div>

          {/* Appointments */}
          <div className="rounded border p-4">
            <h3 className="font-semibold">Appointments</h3>
            <p>Pending: {stats.pendingApps}</p>
            <p>Approved: {stats.approvedApps}</p>
            <p>Completed: {stats.completedApps}</p>
          </div>
        </div>
      )}
    </div>
    </ProtectedLayout>
  );
}
