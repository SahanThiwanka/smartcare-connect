"use client";
import { useState, useEffect, FormEvent, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  uploadRecord,
  getPatientRecords,
  deleteRecord,
  RecordFile,
} from "@/lib/records";
import Image from "next/image";

export default function PatientRecordsPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<RecordFile | null>(null);

  const loadRecords = useCallback(async () => {
    if (!user) return;
    const recs = await getPatientRecords(user.uid);
    recs.sort((a, b) => b.createdAt - a.createdAt);
    setRecords(recs);
  }, [user]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;
    setLoading(true);
    try {
      await uploadRecord(user.uid, file);
      await loadRecords();
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    await deleteRecord(id);
    await loadRecords();
  };

  const renderPreview = (rec: RecordFile) => {
    if (!rec) return null;
    const ext = rec.fileName.split(".").pop()?.toLowerCase();

    if (["jpg", "jpeg", "png"].includes(ext || "")) {
      return (
        <Image
          src={rec.fileUrl}
          alt={rec.fileName}
          width={800} // adjust to your expected max width
          height={600} // adjust height proportionally
          className="max-h-[70vh] mx-auto object-contain"
        />
      );
    }

    if (ext === "pdf") {
      return (
        <iframe
          src={rec.fileUrl}
          className="w-full h-[70vh]"
          title="PDF Preview"
        />
      );
    }

    return (
      <p className="text-gray-500">Preview not available for this file type.</p>
    );
  };

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">My Health Records</h2>

      {/* Upload form */}
      <form onSubmit={onSubmit} className="flex items-center gap-3">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
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
          <div
            key={r.id}
            className="rounded border p-3 flex justify-between items-center"
          >
            <div>
              <p className="font-medium">{r.fileName}</p>
              <p className="text-sm text-gray-500">
                Uploaded: {new Date(r.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPreview(r)}
                className="text-blue-600 hover:underline"
              >
                Preview
              </button>
              <a
                href={r.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:underline"
              >
                View
              </a>
              <button
                onClick={() => onDelete(r.id!)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-600 p-4 rounded max-w-3xl w-full relative">
            <button
              onClick={() => setPreview(null)}
              className="absolute top-2 right-2 text-red-600 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-3">{preview.fileName}</h3>
            {renderPreview(preview)}
          </div>
        </div>
      )}
    </div>
  );
}
