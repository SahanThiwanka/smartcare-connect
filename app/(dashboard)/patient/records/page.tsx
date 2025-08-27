"use client";
import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { uploadRecord, getPatientRecords, RecordFile } from "@/lib/records";

export default function PatientRecordsPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const recs = await getPatientRecords(user.uid);
      setRecords(recs);
    })();
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;
    setLoading(true);
    await uploadRecord(user.uid, file);
    const recs = await getPatientRecords(user.uid);
    setRecords(recs);
    setFile(null);
    setLoading(false);
  };

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">My Health Records</h2>

      {/* Upload form */}
      <form onSubmit={onSubmit} className="flex items-center gap-3">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white"
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {/* List records */}
      <div className="grid gap-3">
        {records.length === 0 && <p>No records uploaded yet.</p>}
        {records.map((r) => (
          <div key={r.id} className="rounded border p-3 flex justify-between">
            <span>{r.fileName}</span>
            <a
              href={r.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
