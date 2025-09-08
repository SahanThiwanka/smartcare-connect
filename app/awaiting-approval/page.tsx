export default function AwaitingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Awaiting Approval</h1>
        <p>
          Your account is pending admin approval. You’ll be notified once your
          profile is verified.
        </p>
      </div>
    </div>
  );
}
