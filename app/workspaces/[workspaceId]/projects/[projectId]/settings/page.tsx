import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteProject, toggleProjectArchive, updateProjectSettings } from "../../actions";
import ConfirmForm from "@/components/confirm-form";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
  });
  if (!project) redirect(`/workspaces/${workspaceId}/projects`);

  const canManage = membership.role === "owner" || membership.role === "admin";
  const isOwner = membership.role === "owner";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name} — Settings</h1>
          <p className="text-sm text-zinc-500">Manage project details and lifecycle.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}/projects`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to projects
        </Link>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await updateProjectSettings(workspaceId, projectId, formData);
        }}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <h3 className="text-lg font-semibold">General</h3>
        <label>
          Name
          <input
            name="name"
            defaultValue={project.name}
            required
            disabled={!canManage}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            defaultValue={project.description ?? ""}
            disabled={!canManage}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        {canManage ? (
          <button className="inline-flex items-center justify-center rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Save changes
          </button>
        ) : (
          <p className="text-sm text-red-600">Only owners/admins can edit project settings.</p>
        )}
      </form>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Archive</h3>
        <p className="text-sm text-zinc-500">
          Archived projects remain read-only in lists but can be restored later.
        </p>
        <form
          action={async () => {
            "use server";
            await toggleProjectArchive(workspaceId, projectId);
          }}
        >
          <button
            disabled={!canManage}
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {project.archived ? "Unarchive project" : "Archive project"}
          </button>
        </form>
      </div>

      <div className="space-y-3 rounded-xl border border-red-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-red-600">Danger zone</h3>
        <p className="text-sm text-zinc-500">
          Deleting a project removes all tasks and activity permanently.
        </p>
        <ConfirmForm
          action={async () => {
            "use server";
            await deleteProject(workspaceId, projectId);
          }}
          message="Delete this project and all tasks? This action cannot be undone."
        >
          <button
            type="submit"
            disabled={!isOwner}
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete project
          </button>
        </ConfirmForm>
        {!isOwner ? (
          <p className="text-sm text-red-600">Only owners can delete projects.</p>
        ) : null}
      </div>
    </div>
  );
}
