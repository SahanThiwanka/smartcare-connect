import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded border bg-white p-6 shadow text-center">
        <h1 className="mb-2 text-2xl font-bold text-red-600">
          403 - Unauthorized
        </h1>
        <p className="mb-4 text-gray-700">
          You don’t have permission to access this page.
        </p>
        <Link
          href="/"
          className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
