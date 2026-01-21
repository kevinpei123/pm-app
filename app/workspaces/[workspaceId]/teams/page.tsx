import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTeam } from "./actions";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  const teams = await prisma.team.findMany({
    where: { workspaceId },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });
  const canManage = membership.role === "owner" || membership.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Teams</h1>
          <p className="text-sm text-zinc-500">Group members inside a workspace.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to workspace
        </Link>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await createTeam(workspaceId, formData);
        }}
        className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <input
          name="name"
          placeholder="Team name"
          disabled={!canManage}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
        />
        <button
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          disabled={!canManage}
        >
          Create team
        </button>
      </form>

      <div className="grid gap-2">
        {teams.length === 0 ? (
          <p className="text-sm text-zinc-500">No teams yet.</p>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3"
            >
              <Link
                href={`/workspaces/${workspaceId}/teams/${team.id}`}
                className="text-sm font-medium hover:underline"
              >
                {team.name}
              </Link>
              <span className="text-xs text-zinc-500">{team._count.members} members</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
