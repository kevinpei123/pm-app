import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEvent } from "./actions";

type TaskEntry = {
  id: string;
  title: string;
  dueDate: Date;
  assigneeId: string | null;
  projectId: string;
};

export default async function WorkspaceCalendarPage({
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

  const tasks = (await prisma.task.findMany({
    where: { workspaceId, dueDate: { not: null } },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assigneeId: true,
      projectId: true,
    },
    orderBy: { dueDate: "asc" },
    take: 200,
  })) as TaskEntry[];

  const events = await prisma.calendarEvent.findMany({
    where: { workspaceId },
    orderBy: { startAt: "asc" },
    take: 50,
  });

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true } } },
  });
  const userById = new Map(members.map((m) => [m.user.id, m.user.name]));

  const grouped = new Map<string, TaskEntry[]>();
  for (const task of tasks) {
    const key = task.dueDate.toISOString().slice(0, 10);
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  }

  const workload = new Map<string, number>();
  for (const task of tasks) {
    if (!task.assigneeId) continue;
    workload.set(task.assigneeId, (workload.get(task.assigneeId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-zinc-500">Upcoming due dates and workload.</p>
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
          await createEvent(workspaceId, formData);
        }}
        className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-3"
      >
        <input
          name="title"
          placeholder="Event title"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <input
          name="startAt"
          type="datetime-local"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <input
          name="endAt"
          type="datetime-local"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <input
          name="description"
          placeholder="Description"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-2"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allDay" />
          All day
        </label>
        <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 md:col-span-3">
          Add event
        </button>
      </form>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Workload</h2>
        {workload.size === 0 ? (
          <p className="text-sm text-zinc-500">No assigned tasks with due dates.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-zinc-600">
            {Array.from(workload.entries()).map(([userId, count]) => (
              <li key={userId}>
                {userById.get(userId) ?? "Unknown"}:{" "}
                <span className="font-semibold text-zinc-800">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">No events yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{event.title}</div>
                  <div className="text-xs text-zinc-500">
                    {event.startAt.toISOString().slice(0, 16).replace("T", " ")} →{" "}
                    {event.endAt.toISOString().slice(0, 16).replace("T", " ")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        {grouped.size === 0 ? (
          <p className="text-sm text-zinc-500">No tasks with due dates.</p>
        ) : (
          Array.from(grouped.entries()).map(([date, items]) => (
            <div key={date} className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-base font-semibold">{date}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {items.map((task) => (
                  <li key={task.id} className="flex items-center justify-between">
                    <Link
                      href={`/workspaces/${workspaceId}/projects/${task.projectId}`}
                      className="hover:underline"
                    >
                      {task.title}
                    </Link>
                    <span className="text-xs text-zinc-500">
                      {task.assigneeId ? userById.get(task.assigneeId) ?? "Unassigned" : "Unassigned"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
