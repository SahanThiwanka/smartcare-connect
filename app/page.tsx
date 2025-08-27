export default function HomePage() {
  return (
    <section className="grid gap-6 py-10">
      <h1 className="text-3xl font-bold">Welcome to SmartCare Connect</h1>
      <p>
        Connecting patients and doctors for faster, safer, and more personalized
        care.
      </p>
      <ul className="list-disc pl-6 text-sm text-gray-700">
        <li>Register/Login as Patient or Doctor from the navbar.</li>
        <li>After login, see a role-specific dashboard.</li>
      </ul>
    </section>
  );
}
