import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: session.user.id },
    },
  });

  if (!membership) redirect("/workspaces");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) redirect("/workspaces");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <div className="mt-2 text-sm text-zinc-600">
          Role:{" "}
          <span className="inline-flex items-center rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {membership.role}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/workspaces" className="rounded-md border border-zinc-200 px-3 py-2 hover:bg-zinc-50">
          ← Back to workspaces
        </Link>
        <Link
          href={`/workspaces/${workspaceId}/projects`}
          className="rounded-md border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
        >
          Projects →
        </Link>
        <Link
          href={`/workspaces/${workspaceId}/members`}
          className="rounded-md border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
        >
          Members →
        </Link>
        <Link
          href={`/workspaces/${workspaceId}/settings`}
          className="rounded-md border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
        >
          Workspace settings →
        </Link>
      </div>
    </div>
  );
}
