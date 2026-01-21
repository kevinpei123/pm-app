export default function WorkspaceLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-6 py-6">
      <aside className="w-64 shrink-0 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-4 w-full animate-pulse rounded bg-zinc-100" />
          ))}
        </div>
        <div className="mt-6 h-4 w-24 animate-pulse rounded bg-zinc-200" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-4 w-full animate-pulse rounded bg-zinc-100" />
          ))}
        </div>
      </aside>
      <main className="flex-1 space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-zinc-100" />
      </main>
    </div>
  );
}
