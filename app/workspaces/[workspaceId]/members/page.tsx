import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InviteForm from "./InviteForm";
import { updateMemberRole, removeMember } from "./actions";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const me = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!me) redirect("/workspaces");

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) redirect("/workspaces");

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });

  const userIds = members.map((m) => m.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const canInvite = me.role === "owner" || me.role === "admin";
  const canManageRoles = me.role === "owner" || me.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{workspace.name} — Members</h1>
          <p className="text-sm text-zinc-500">Manage membership and roles.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Workspace home
        </Link>
      </div>

      <div className="space-y-3">
        {members.map((m) => {
          const u = userById.get(m.userId);
          return (
            <div key={m.id} className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
              <div>
                <div className="text-base font-semibold">{u?.name ?? "Unknown"}</div>
                <div className="text-sm text-zinc-500">{u?.email ?? m.userId}</div>
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {m.role}
                  </span>
                </div>
              </div>
                {canManageRoles ? (
                  <div className="flex flex-wrap gap-2">
                    {m.role === "member" ? (
                      <form action={updateMemberRole}>
                        <input type="hidden" name="workspaceId" value={workspaceId} />
                        <input type="hidden" name="userId" value={m.userId} />
                        <input type="hidden" name="role" value="admin" />
                        <button className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
                          Promote to admin
                        </button>
                      </form>
                    ) : null}
                    {m.role === "admin" ? (
                      <form action={updateMemberRole}>
                        <input type="hidden" name="workspaceId" value={workspaceId} />
                        <input type="hidden" name="userId" value={m.userId} />
                        <input type="hidden" name="role" value="member" />
                        <button className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
                          Demote to member
                        </button>
                      </form>
                    ) : null}
                    {m.role !== "owner" && m.userId !== session.user.id ? (
                      <form action={removeMember}>
                        <input type="hidden" name="workspaceId" value={workspaceId} />
                        <input type="hidden" name="userId" value={m.userId} />
                        <button className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
            </div>
          );
        })}
      </div>

      {canInvite ? <InviteForm workspaceId={workspaceId} /> : null}
      {!canInvite ? (
        <p className="text-sm text-red-600">
          You don’t have permission to invite members (owner/admin only).
        </p>
      ) : null}
    </div>
  );
}
