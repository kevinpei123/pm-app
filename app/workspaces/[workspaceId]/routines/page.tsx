import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeHabit, createHabit, deleteHabit } from "../habits/actions";
import { createReminder, deleteReminder, toggleReminder } from "../reminders/actions";
import { createTimeEntry, deleteTimeEntry } from "../time/actions";

export default async function RoutinesPage({
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

  const [habits, reminders, entries, projects, tasks] = await prisma.$transaction([
    prisma.habit.findMany({
      where: { workspaceId, userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reminder.findMany({
      where: { workspaceId, userId: session.user.id },
      orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.timeEntry.findMany({
      where: { workspaceId, userId: session.user.id },
      orderBy: { startAt: "desc" },
      take: 50,
    }),
    prisma.project.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { workspaceId },
      select: { id: true, title: true },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Routines</h1>
          <p className="text-sm text-zinc-500">Habits, reminders, and time tracking in one view.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to workspace
        </Link>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Habits</h2>
          <p className="text-sm text-zinc-500">Track routines and streaks.</p>
        </div>
        <form
          action={async (formData) => {
            "use server";
            await createHabit(workspaceId, formData);
          }}
          className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <input
            name="title"
            placeholder="Habit title"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
          />
          <select
            name="cadence"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </select>
          <input
            type="number"
            name="targetPerWeek"
            min={1}
            max={14}
            defaultValue={5}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
          />
          <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Add habit
          </button>
        </form>
        <div className="grid gap-2">
          {habits.length === 0 ? (
            <p className="text-sm text-zinc-500">No habits yet.</p>
          ) : (
            habits.map((habit) => (
              <div
                key={habit.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3"
              >
                <div>
                  <div className="text-sm font-medium">{habit.title}</div>
                  <div className="text-xs text-zinc-500">
                    {habit.cadence} · Target {habit.targetPerWeek}/week · Streak {habit.streak}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await completeHabit(workspaceId, habit.id);
                    }}
                  >
                    <button className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50">
                      Complete
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await deleteHabit(workspaceId, habit.id);
                    }}
                  >
                    <button className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Reminders</h2>
          <p className="text-sm text-zinc-500">Quick nudges for important work.</p>
        </div>
        <form
          action={async (formData) => {
            "use server";
            await createReminder(workspaceId, formData);
          }}
          className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <input
            name="title"
            placeholder="Reminder title"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
          />
          <input
            type="datetime-local"
            name="dueAt"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
          />
          <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Add reminder
          </button>
        </form>
        <div className="grid gap-2">
          {reminders.length === 0 ? (
            <p className="text-sm text-zinc-500">No reminders yet.</p>
          ) : (
            reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3"
              >
                <div>
                  <div
                    className={`text-sm font-medium ${
                      reminder.completedAt ? "line-through text-zinc-400" : ""
                    }`}
                  >
                    {reminder.title}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {reminder.dueAt
                      ? `Due ${reminder.dueAt.toISOString().slice(0, 16).replace("T", " ")}`
                      : "No due date"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await toggleReminder(workspaceId, reminder.id);
                    }}
                  >
                    <button className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50">
                      {reminder.completedAt ? "Mark open" : "Complete"}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await deleteReminder(workspaceId, reminder.id);
                    }}
                  >
                    <button className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Time entries</h2>
          <p className="text-sm text-zinc-500">Log time spent on tasks.</p>
        </div>
        <form
          action={async (formData) => {
            "use server";
            await createTimeEntry(workspaceId, formData);
          }}
          className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-3"
        >
          <input
            name="description"
            placeholder="What did you work on?"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-3"
          />
          <input
            type="datetime-local"
            name="startAt"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            name="endAt"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
          <select
            name="projectId"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Project (optional)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            name="taskId"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-2"
          >
            <option value="">Task (optional)</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 md:col-span-3">
            Add entry
          </button>
        </form>

        <div className="grid gap-2">
          {entries.length === 0 ? (
            <p className="text-sm text-zinc-500">No time entries yet.</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3"
              >
                <div>
                  <div className="text-sm font-medium">{entry.description || "Time entry"}</div>
                  <div className="text-xs text-zinc-500">
                    {entry.startAt.toISOString().slice(0, 16).replace("T", " ")} →{" "}
                    {entry.endAt.toISOString().slice(0, 16).replace("T", " ")} · {entry.minutes} min
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await deleteTimeEntry(workspaceId, entry.id);
                  }}
                >
                  <button className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50">
                    Delete
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
