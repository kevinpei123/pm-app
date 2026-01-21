import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteWorkspace, leaveWorkspace, transferWorkspaceOwnership, updateWorkspaceSettings } from "./actions";
import ConfirmForm from "@/components/confirm-form";

export default async function WorkspaceSettingsPage({
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

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) redirect("/workspaces");

  const isOwner = membership.role === "owner";
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{workspace.name} — Settings</h1>
          <p className="text-sm text-zinc-500">Manage workspace settings and membership.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Workspace home
        </Link>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await updateWorkspaceSettings(workspaceId, formData);
        }}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <h3 className="text-lg font-semibold">Rename workspace</h3>
        <input
          name="name"
          defaultValue={workspace.name}
          required
          disabled={!isOwner}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!isOwner}
          className="inline-flex items-center justify-center rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          Save
        </button>
        {!isOwner ? (
          <p className="text-sm text-red-600">Only owners can rename workspaces.</p>
        ) : null}
      </form>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Transfer ownership</h3>
        <p className="text-sm text-zinc-500">
          Owners can transfer ownership to another member. Admins cannot become owners without a
          transfer.
        </p>
        <ConfirmForm
          action={async (formData) => {
            "use server";
            await transferWorkspaceOwnership(workspaceId, formData);
          }}
          message="Transfer ownership to this member? You will become an admin."
        >
          <select
            name="newOwnerId"
            disabled={!isOwner}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select member</option>
            {members
              .filter((m) => m.userId !== membership.userId)
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name} ({m.user.email}) — {m.role}
                </option>
              ))}
          </select>
          <button
            type="submit"
            disabled={!isOwner}
            className="mt-3 inline-flex items-center justify-center rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Transfer ownership
          </button>
        </ConfirmForm>
        {!isOwner ? (
          <p className="text-sm text-red-600">Only owners can transfer ownership.</p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Leave workspace</h3>
        <p className="text-sm text-zinc-500">
          Leaving removes your membership and unassigns your tasks.
        </p>
        <form
          action={async () => {
            "use server";
            await leaveWorkspace(workspaceId);
          }}
        >
          <button
            type="submit"
            disabled={isOwner}
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            Leave workspace
          </button>
        </form>
        {isOwner ? (
          <p className="text-sm text-red-600">Owners must transfer ownership before leaving.</p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-red-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-red-600">Delete workspace</h3>
        <p className="text-sm text-zinc-500">
          Deleting removes all projects, tasks, and members permanently.
        </p>
        <ConfirmForm
          action={async () => {
            "use server";
            await deleteWorkspace(workspaceId);
          }}
          message="Delete this workspace? This action cannot be undone."
        >
          <button
            type="submit"
            disabled={!isOwner}
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete workspace
          </button>
        </ConfirmForm>
        {!isOwner ? (
          <p className="text-sm text-red-600">Only owners can delete workspaces.</p>
        ) : null}
      </div>
    </div>
  );
}
