import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createTask } from "./actions";
import KanbanBoard from "./KanbanBoard";
import FullPageToggle from "@/components/full-page-toggle";

const COLUMNS = [
  { key: "todo", title: "Todo" },
  { key: "in_progress", title: "In Progress" },
  { key: "done", title: "Done" },
] as const;

type StatusKey = (typeof COLUMNS)[number]["key"];

const normalizeStatus = (status: string): StatusKey => {
  if (status === "todo" || status === "in_progress" || status === "done") {
    return status;
  }
  return "todo";
};

export default async function ProjectBoard({
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

  const tasks = await prisma.task.findMany({
    where: { workspaceId, projectId },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      order: true,
      assigneeId: true,
      dueDate: true,
      startDate: true,
      durationMinutes: true,
      priority: true,
      type: true,
      inbox: true,
      recurrenceRule: true,
      recurrenceTimezone: true,
      recurrenceExceptions: true,
      recurrenceEndAt: true,
      blocked: true,
      dependencies: { select: { dependsOnId: true } },
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      watchers: { select: { userId: true } },
    },
  });

  type TaskWithTags = Prisma.TaskGetPayload<{
    select: {
      id: true;
      title: true;
      description: true;
      status: true;
      order: true;
      assigneeId: true;
      dueDate: true;
      startDate: true;
      durationMinutes: true;
      priority: true;
      type: true;
      inbox: true;
      recurrenceRule: true;
      recurrenceTimezone: true;
      recurrenceExceptions: true;
      recurrenceEndAt: true;
      blocked: true;
      dependencies: { select: { dependsOnId: true } };
      tags: { select: { tag: { select: { id: true; name: true; color: true } } } };
      watchers: { select: { userId: true } };
    };
  }>;
  const tasksWithTags = tasks as TaskWithTags[];

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const tags = await prisma.tag.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });


  return (
    <div className="space-y-6">
      <FullPageToggle enabled />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {project.description ? (
            <div className="text-sm text-zinc-500">{project.description}</div>
          ) : null}
        </div>
        <Link
          href={`/workspaces/${workspaceId}/projects`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          ← Back to projects
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={`/workspaces/${workspaceId}/projects/${projectId}/goals`}
          className="rounded-md border border-zinc-200 px-3 py-1 hover:bg-zinc-50"
        >
          Goals
        </Link>
        <Link
          href={`/workspaces/${workspaceId}/projects/${projectId}/milestones`}
          className="rounded-md border border-zinc-200 px-3 py-1 hover:bg-zinc-50"
        >
          Milestones
        </Link>
        <Link
          href={`/workspaces/${workspaceId}/projects/${projectId}/members`}
          className="rounded-md border border-zinc-200 px-3 py-1 hover:bg-zinc-50"
        >
          Members
        </Link>
        <Link
          href={`/workspaces/${workspaceId}/projects/${projectId}/settings`}
          className="rounded-md border border-zinc-200 px-3 py-1 hover:bg-zinc-50"
        >
          Settings
        </Link>
      </div>

      {/* Keep “Add task” forms as server actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <h3 className="text-base font-semibold">{col.title}</h3>

            <form
              action={async (formData) => {
                "use server";
                await createTask(workspaceId, projectId, col.key, formData);
              }}
              className="mt-3 flex flex-wrap gap-2"
            >
              <input
                name="title"
                placeholder={`Add to ${col.title}`}
                required
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
              <button className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
                Add
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* Drag & drop board (client) */}
      <KanbanBoard
        workspaceId={workspaceId}
        projectId={projectId}
        currentUserId={session.user.id}
        initialTasks={tasksWithTags.map((t) => ({
          ...t,
          status: normalizeStatus(t.status),
          dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
          startDate: t.startDate ? t.startDate.toISOString() : null,
          recurrenceEndAt: t.recurrenceEndAt ? t.recurrenceEndAt.toISOString() : null,
          recurrenceExceptions: Array.isArray(t.recurrenceExceptions)
            ? t.recurrenceExceptions.map((value) => String(value))
            : null,
          dependencyIds: t.dependencies.map((d) => d.dependsOnId),
          tags: t.tags.map((tt) => tt.tag),
          tagIds: t.tags.map((tt) => tt.tag.id),
          watcherIds: t.watchers.map((w) => w.userId),
        }))}
        availableTags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        members={members.map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        }))}
      />
    </div>
    
  );
}
