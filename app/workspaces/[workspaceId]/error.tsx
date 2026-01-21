"use client";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
      <h1 className="text-2xl font-semibold">Workspace error</h1>
      <p className="text-sm text-zinc-500">Please try again.</p>
      <button
        className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        onClick={reset}
      >
        Retry
      </button>
    </div>
  );
}
