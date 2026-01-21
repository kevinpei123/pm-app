import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMilestone } from "../meta-actions";

export default async function ProjectMilestonesPage({
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

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
  if (!project) redirect(`/workspaces/${workspaceId}/projects`);

  const milestones = await prisma.milestone.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Milestones</h1>
          <p className="text-sm text-zinc-500">{project.name}</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}/projects/${projectId}`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to project
        </Link>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await createMilestone(workspaceId, projectId, formData);
        }}
        className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <input
          name="title"
          placeholder="Milestone title"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          placeholder="Description (optional)"
          rows={3}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="dueDate"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Add milestone
        </button>
      </form>

      <div className="grid gap-2">
        {milestones.length === 0 ? (
          <p className="text-sm text-zinc-500">No milestones yet.</p>
        ) : (
          milestones.map((milestone) => (
            <div key={milestone.id} className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="text-sm font-medium">{milestone.title}</div>
              {milestone.description ? (
                <div className="text-xs text-zinc-500">{milestone.description}</div>
              ) : null}
              {milestone.dueDate ? (
                <div className="text-xs text-zinc-500">
                  Due: {milestone.dueDate.toISOString().slice(0, 10)}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
