import Link from "next/link";
import { createWorkspace } from "./actions";

export default function NewWorkspacePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Create workspace</h1>
        <p className="text-sm text-zinc-500">Give your workspace a short, clear name.</p>
      </div>

      <form action={createWorkspace} className="space-y-3">
        <input
          name="name"
          placeholder="Workspace name"
          required
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <button className="inline-flex items-center justify-center rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Create
        </button>
      </form>

      <Link href="/workspaces" className="text-sm text-zinc-600 hover:underline">
        Back
      </Link>
    </div>
  );
}
