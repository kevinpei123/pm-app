import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProject, toggleProjectArchive } from "./actions";

export default async function ProjectsPage({
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

  const projects = await prisma.project.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{workspace.name} — Projects</h1>
          <p className="text-sm text-zinc-500">Create, archive, and manage projects.</p>
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
          await createProject(workspaceId, formData);
        }}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <h3 className="text-lg font-semibold">Create project</h3>
        <input
          name="name"
          placeholder="Project name"
          required
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          placeholder="Description (optional)"
          rows={3}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <button className="inline-flex items-center justify-center rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Create
        </button>
      </form>

      <h3 className="text-lg font-semibold">Your projects</h3>
      {projects.length === 0 ? (
        <p className="text-sm text-zinc-500">No projects yet.</p>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-6 rounded-xl border border-zinc-200 bg-white p-4">
              <div>
                <Link href={`/workspaces/${workspaceId}/projects/${p.id}`} className="text-lg font-semibold">
                  {p.name}
                </Link>
                {p.archived ? (
                  <span className="ml-2 inline-flex items-center rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    Archived
                  </span>
                ) : null}
                {p.description ? <div className="mt-1 text-sm text-zinc-500">{p.description}</div> : null}
                <div className="mt-2 text-sm">
                  <Link
                    href={`/workspaces/${workspaceId}/projects/${p.id}/settings`}
                    className="text-zinc-700 hover:underline"
                  >
                    Settings
                  </Link>
                </div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await toggleProjectArchive(workspaceId, p.id);
                }}
              >
                <button className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
                  {p.archived ? "Unarchive" : "Archive"}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
