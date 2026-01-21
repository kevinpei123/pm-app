import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MyTasks from "@/components/my-tasks";
import { createQuickTask, deleteTaskFilter, saveTaskFilter } from "./actions";

export default async function WorkspacesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: {
      workspace: {
        include: {
          projects: { orderBy: { updatedAt: "desc" } },
          tags: true,
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const workspaceIds = memberships.map((m) => m.workspaceId);
  const tasks = workspaceIds.length
    ? await prisma.task.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          deletedAt: null,
          OR: [
            { assigneeId: session.user.id },
            { createdById: session.user.id },
            { watchers: { some: { userId: session.user.id } } },
          ],
        },
        include: {
          project: { select: { id: true, name: true } },
          workspace: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
          dependencies: { select: { dependsOnId: true } },
          reminders: { select: { id: true, remindAt: true, snoozedUntil: true, completedAt: true } },
          watchers: { select: { userId: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      })
    : [];

  const savedFilters = workspaceIds.length
    ? await prisma.savedTaskFilter.findMany({
        where: { userId: session.user.id, workspaceId: { in: workspaceIds } },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const taskItems = tasks.map((task) => {
    const workspaceMembership = memberships.find((m) => m.workspaceId === task.workspaceId);
    const assignee = workspaceMembership?.workspace.members.find((m) => m.userId === task.assigneeId);
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      startDate: task.startDate ? task.startDate.toISOString() : null,
      durationMinutes: task.durationMinutes ?? null,
      type: task.type,
      inbox: task.inbox,
      blocked: task.blocked,
      workspaceId: task.workspaceId,
      workspaceName: task.workspace.name,
      projectId: task.projectId,
      projectName: task.project?.name ?? "Unknown",
      assigneeId: task.assigneeId,
      assigneeName: assignee?.user.name ?? assignee?.user.email ?? null,
      tags: task.tags.map((t) => t.tag.name),
      dependencyIds: task.dependencies.map((d) => d.dependsOnId),
      reminders: task.reminders.map((reminder) => ({
        id: reminder.id,
        remindAt: reminder.remindAt.toISOString(),
        snoozedUntil: reminder.snoozedUntil ? reminder.snoozedUntil.toISOString() : null,
        completedAt: reminder.completedAt ? reminder.completedAt.toISOString() : null,
      })),
      watcherIds: task.watchers.map((watcher) => watcher.userId),
      archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
    };
  });

  const workspaceOptions = memberships.map((membership) => ({
    id: membership.workspace.id,
    name: membership.workspace.name,
    projects: membership.workspace.projects.map((project) => ({ id: project.id, name: project.name })),
    members: membership.workspace.members.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
    })),
    tags: membership.workspace.tags.map((tag) => ({ id: tag.id, name: tag.name })),
  }));

  return (
    <div className="space-y-6">
      <MyTasks
        tasks={taskItems}
        workspaces={workspaceOptions}
        savedFilters={savedFilters.map((filter) => ({
          id: filter.id,
          workspaceId: filter.workspaceId,
          name: filter.name,
          filters: filter.filters as Record<string, unknown>,
        }))}
        createQuickTask={createQuickTask}
        saveTaskFilter={saveTaskFilter}
        deleteTaskFilter={deleteTaskFilter}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workspaces</h1>
          <p className="text-sm text-zinc-500">Pick a workspace to continue.</p>
        </div>
        <Link
          href="/workspaces/new"
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          + New workspace
        </Link>
      </div>

      {memberships.length === 0 ? (
        <p className="text-sm text-zinc-600">
          You’re not in any workspaces yet. <Link href="/workspaces/new">Create one</Link>.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {memberships.map((m) => (
            <div key={m.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <Link href={`/workspaces/${m.workspace.id}`} className="text-lg font-semibold">
                {m.workspace.name}
              </Link>
              <div className="mt-2 text-sm text-zinc-500">
                Role:{" "}
                <span className="inline-flex items-center rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {m.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
