import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGoal } from "../meta-actions";

export default async function ProjectGoalsPage({
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

  const goals = await prisma.goal.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Goals</h1>
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
          await createGoal(workspaceId, projectId, formData);
        }}
        className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <input
          name="title"
          placeholder="Goal title"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          placeholder="Description (optional)"
          rows={3}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Add goal
        </button>
      </form>

      <div className="grid gap-2">
        {goals.length === 0 ? (
          <p className="text-sm text-zinc-500">No goals yet.</p>
        ) : (
          goals.map((goal) => (
            <div key={goal.id} className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="text-sm font-medium">{goal.title}</div>
              {goal.description ? (
                <div className="text-xs text-zinc-500">{goal.description}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
