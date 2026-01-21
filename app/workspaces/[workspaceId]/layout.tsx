import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) redirect("/workspaces");

  const projects = await prisma.project.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-6 py-6">
      <aside className="workspace-sidebar flex w-64 shrink-0 flex-col rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          {workspace.name}
        </div>
        <nav className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto text-sm pr-1">
          <Link
            href={`/workspaces/${workspaceId}`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Overview
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/search`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Search
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/calendar`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Calendar
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/updates`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Updates
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/routines`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Routines
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/docs`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Docs
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/teams`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Teams
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/tags`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Tags
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/members`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Members
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/settings`}
            className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            Settings
          </Link>
          <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Projects
          </div>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            {projects.length === 0 ? (
              <span className="text-zinc-600">No projects yet</span>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/workspaces/${workspaceId}/projects/${project.id}`}
                  className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100"
                >
                  {project.name}
                </Link>
              ))
            )}
          </div>
        </nav>
        <Link
          href={`/workspaces/${workspaceId}/projects`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Manage projects
        </Link>
      </aside>
      <main className="workspace-main min-w-0 flex-1">{children}</main>
    </div>
  );
}
