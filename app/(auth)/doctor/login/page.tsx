"use client";
import { FormEvent, useState } from "react";
import { loginWithEmail, getUserRole } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function DoctorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const user = await loginWithEmail(email, password);
      const role = await getUserRole(user.uid);
      if (role === "doctor") router.push("/doctor/profile");
      else router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-4 text-2xl font-semibold">Doctor Login</h2>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input
          className="rounded border p-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded border p-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="rounded bg-black px-4 py-2 text-white">Login</button>
      </form>
    </div>
  );
}
