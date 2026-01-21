import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/workspaces");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <main className="w-full max-w-2xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">pm-app</h1>
          <p className="text-sm text-zinc-500">
            A lightweight project manager for teams. Organize workspaces, projects, and tasks in
            one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
}
