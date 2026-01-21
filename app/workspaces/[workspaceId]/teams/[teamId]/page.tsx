import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addTeamMember, removeTeamMember } from "../actions";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; teamId: string }>;
}) {
  const { workspaceId, teamId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  const team = await prisma.team.findFirst({
    where: { id: teamId, workspaceId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!team) redirect(`/workspaces/${workspaceId}/teams`);

  const canManage = membership.role === "owner" || membership.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          <p className="text-sm text-zinc-500">Manage team members.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}/teams`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to teams
        </Link>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await addTeamMember(teamId, workspaceId, formData);
        }}
        className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <input
          name="email"
          placeholder="user@example.com"
          disabled={!canManage}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
        />
        <button
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          disabled={!canManage}
        >
          Add member
        </button>
      </form>

      <div className="grid gap-2">
        {team.members.length === 0 ? (
          <p className="text-sm text-zinc-500">No team members yet.</p>
        ) : (
          team.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3"
            >
              <div>
                <div className="text-sm font-medium">{member.user.name}</div>
                <div className="text-xs text-zinc-500">{member.user.email}</div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await removeTeamMember(teamId, workspaceId, member.userId);
                }}
              >
                <button
                  className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50"
                  disabled={!canManage}
                >
                  Remove
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
