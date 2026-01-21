export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-64 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-100" />
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
        <div className="h-10 w-full animate-pulse rounded bg-zinc-100" />
        <div className="h-20 w-full animate-pulse rounded bg-zinc-100" />
        <div className="h-8 w-20 animate-pulse rounded bg-zinc-100" />
      </div>

      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="h-24 w-full animate-pulse rounded-xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
