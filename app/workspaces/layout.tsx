import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WorkspacesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId?: string }>;
}) {
  const { workspaceId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  if (workspaceId) {
    return <div className="mx-auto w-full max-w-6xl px-6 py-6">{children}</div>;
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-6 py-6">
      <aside className="w-64 shrink-0 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Workspaces
        </div>
        <nav className="mt-3 flex flex-col gap-2 text-sm">
          {memberships.length === 0 ? (
            <span className="text-zinc-600">No workspaces yet</span>
          ) : (
            memberships.map((m) => (
              <Link
                key={m.workspace.id}
                href={`/workspaces/${m.workspace.id}`}
                className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
              >
                {m.workspace.name}
              </Link>
            ))
          )}
        </nav>
        <Link
          href="/workspaces/new"
          className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          + New workspace
        </Link>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
