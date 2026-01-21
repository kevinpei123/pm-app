"use client";

import { useMemo, useState, useTransition } from "react";

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  startDate: string | null;
  durationMinutes: number | null;
  type: string;
  inbox: boolean;
  blocked: boolean;
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  tags: string[];
  dependencyIds: string[];
  reminders: { id: string; remindAt: string; snoozedUntil: string | null; completedAt: string | null }[];
  watcherIds: string[];
  archivedAt: string | null;
};

type WorkspaceOption = {
  id: string;
  name: string;
  projects: { id: string; name: string }[];
  members: { id: string; name: string | null; email: string }[];
  tags: { id: string; name: string }[];
};

type SavedFilter = {
  id: string;
  workspaceId: string;
  name: string;
  filters: Record<string, unknown>;
};

type QuickAddAction = (formData: FormData) => Promise<void>;

type SaveFilterAction = (formData: FormData) => Promise<void>;

type DeleteFilterAction = (workspaceId: string, filterId: string) => Promise<void>;

type Props = {
  tasks: TaskItem[];
  workspaces: WorkspaceOption[];
  savedFilters: SavedFilter[];
  createQuickTask: QuickAddAction;
  saveTaskFilter: SaveFilterAction;
  deleteTaskFilter: DeleteFilterAction;
};

export default function MyTasks({
  tasks,
  workspaces,
  savedFilters,
  createQuickTask,
  saveTaskFilter,
  deleteTaskFilter,
}: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [priorityMin, setPriorityMin] = useState(0);
  const [priorityMax, setPriorityMax] = useState(5);
  const [dueFilter, setDueFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [inboxOnly, setInboxOnly] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState("dueDate");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveName, setSaveName] = useState("");
  const [selectedFilterId, setSelectedFilterId] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    workspaces[0]?.id ?? ""
  );
  const [selectedProjectId, setSelectedProjectId] = useState(
    workspaces[0]?.projects[0]?.id ?? ""
  );
  const [pending, startTransition] = useTransition();
  const hasWorkspaces = workspaces.length > 0;

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));

    return tasks
      .filter((task) => (!inboxOnly ? true : task.inbox))
      .filter((task) => (showArchived ? true : task.archivedAt === null))
      .filter((task) => (workspaceFilter === "all" ? true : task.workspaceId === workspaceFilter))
      .filter((task) => (statusFilter === "all" ? true : task.status === statusFilter))
      .filter((task) => (tagFilter === "all" ? true : task.tags.includes(tagFilter)))
      .filter((task) => task.priority >= priorityMin && task.priority <= priorityMax)
      .filter((task) => {
        if (dueFilter === "all") return true;
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        if (dueFilter === "overdue") return due < now;
        if (dueFilter === "this_week") return due >= now && due <= endOfWeek;
        return true;
      })
      .filter((task) =>
        query
          ? `${task.title} ${task.description ?? ""}`.toLowerCase().includes(query.toLowerCase())
          : true
      )
      .sort((a, b) => {
        switch (sortBy) {
          case "priority":
            return b.priority - a.priority;
          case "created":
            return a.id.localeCompare(b.id);
          case "dueDate": {
            const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            return aDue - bDue;
          }
          default:
            return 0;
        }
      });
  }, [
    tasks,
    inboxOnly,
    showArchived,
    workspaceFilter,
    statusFilter,
    priorityMin,
    priorityMax,
    dueFilter,
    tagFilter,
    query,
    sortBy,
  ]);

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);
  const projects = selectedWorkspace?.projects ?? [];
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const workspace of workspaces) {
      for (const tag of workspace.tags) set.add(tag.name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [workspaces]);
  const canBulkUpdate =
    selectedIds.length > 0 &&
    new Set(filteredTasks.filter((t) => selectedIds.includes(t.id)).map((t) => t.workspaceId)).size ===
      1;

  const serializedFilters = JSON.stringify({
    statusFilter,
    workspaceFilter,
    priorityMin,
    priorityMax,
    dueFilter,
    tagFilter,
    inboxOnly,
    showArchived,
    sortBy,
  });

  const applySavedFilter = (filterId: string) => {
    const filter = savedFilters.find((f) => f.id === filterId);
    if (!filter) return;
    const data = filter.filters as Record<string, unknown>;
    if (typeof data.statusFilter === "string") setStatusFilter(data.statusFilter as string);
    if (typeof data.workspaceFilter === "string") setWorkspaceFilter(data.workspaceFilter as string);
    if (typeof data.priorityMin === "number") setPriorityMin(data.priorityMin as number);
    if (typeof data.priorityMax === "number") setPriorityMax(data.priorityMax as number);
    if (typeof data.dueFilter === "string") setDueFilter(data.dueFilter as string);
    if (typeof data.tagFilter === "string") setTagFilter(data.tagFilter as string);
    if (typeof data.inboxOnly === "boolean") setInboxOnly(data.inboxOnly as boolean);
    if (typeof data.showArchived === "boolean") setShowArchived(data.showArchived as boolean);
    if (typeof data.sortBy === "string") setSortBy(data.sortBy as string);
  };

  const handleBulkUpdate = (updates: Record<string, unknown>) => {
    if (!canBulkUpdate) return;
    startTransition(async () => {
      await fetch("/api/tasks/bulk-update-global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: selectedIds, updates }),
      });
      setSelectedIds([]);
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      await Promise.all(
        selectedIds.map((taskId) =>
          fetch("/api/tasks/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId: filteredTasks.find((t) => t.id === taskId)?.workspaceId,
              taskId,
            }),
          })
        )
      );
      setSelectedIds([]);
    });
  };

  const addReminder = async (task: TaskItem, remindAt: string) => {
    await fetch("/api/tasks/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: task.workspaceId, taskId: task.id, remindAt }),
    });
  };

  const snoozeReminder = async (reminderId: string, minutes: number) => {
    await fetch("/api/tasks/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderId, snoozeMinutes: minutes }),
    });
  };

  const completeReminder = async (reminderId: string) => {
    await fetch("/api/tasks/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderId, complete: true }),
    });
  };

  return (
    <section className="space-y-4">
      {!hasWorkspaces ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-lg font-semibold">My Tasks</h2>
          <p className="text-sm text-zinc-500">
            Join or create a workspace to start capturing tasks.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">My Tasks</h2>
            <p className="text-sm text-zinc-500">Capture, triage, and schedule across projects.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-md border px-3 py-1 text-sm ${
                inboxOnly ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500"
              }`}
              onClick={() => setInboxOnly((prev) => !prev)}
            >
              {inboxOnly ? "Inbox" : "All tasks"}
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-1 text-sm ${
                showArchived ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500"
              }`}
              onClick={() => setShowArchived((prev) => !prev)}
            >
              {showArchived ? "Archived on" : "Archived off"}
            </button>
          </div>
        </div>

        <form action={createQuickTask} className="mt-4 grid gap-2 md:grid-cols-4">
          <input type="hidden" name="workspaceId" value={selectedWorkspaceId} />
          <input type="hidden" name="projectId" value={selectedProjectId} />
          <input
            name="input"
            placeholder=""
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={selectedWorkspaceId}
            onChange={(event) => {
              const workspaceId = event.target.value;
              setSelectedWorkspaceId(workspaceId);
              const firstProject = workspaces.find((w) => w.id === workspaceId)?.projects[0]?.id ?? "";
              setSelectedProjectId(firstProject);
            }}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            {projects.length === 0 ? <option value="">No projects</option> : null}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 md:col-span-4"
            disabled={pending || projects.length === 0}
          >
            {pending ? "Adding..." : "Add task"}
          </button>
        </form>
        </div>
      )}

      {hasWorkspaces ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
          />
          <select
            value={workspaceFilter}
            onChange={(event) => setWorkspaceFilter(event.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All workspaces</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
          <select
            value={dueFilter}
            onChange={(event) => setDueFilter(event.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All due dates</option>
            <option value="overdue">Overdue</option>
            <option value="this_week">This week</option>
          </select>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="dueDate">Sort by due</option>
            <option value="priority">Sort by priority</option>
            <option value="created">Sort by created</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            Priority
            <input
              type="number"
              min={0}
              max={5}
              value={priorityMin}
              onChange={(event) => setPriorityMin(Number(event.target.value))}
              className="w-16 rounded-md border border-zinc-200 px-2 py-1"
            />
          </label>
          <span>to</span>
          <label className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={5}
              value={priorityMax}
              onChange={(event) => setPriorityMax(Number(event.target.value))}
              className="w-16 rounded-md border border-zinc-200 px-2 py-1"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedFilterId}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedFilterId(id);
              applySavedFilter(id);
            }}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Saved filters</option>
            {savedFilters.map((filter) => (
              <option key={filter.id} value={filter.id}>
                {filter.name}
              </option>
            ))}
          </select>
          <form action={saveTaskFilter} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="workspaceId" value={workspaceFilter === "all" ? selectedWorkspaceId : workspaceFilter} />
            <input type="hidden" name="filters" value={serializedFilters} />
            <input
              name="name"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              placeholder="Save filter as"
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm"
            />
            <button className="rounded-md border border-zinc-200 px-2 py-1 text-sm">Save</button>
          </form>
          {selectedFilterId ? (
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1 text-sm"
              onClick={() => {
                const filter = savedFilters.find((f) => f.id === selectedFilterId);
                if (filter) {
                  startTransition(async () => {
                    await deleteTaskFilter(filter.workspaceId, filter.id);
                  });
                }
              }}
            >
              Delete saved filter
            </button>
          ) : null}
        </div>

        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-sm">
            <span>{selectedIds.length} selected</span>
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1"
              onClick={() => handleBulkUpdate({ status: "todo" })}
              disabled={!canBulkUpdate}
            >
              Mark todo
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1"
              onClick={() => handleBulkUpdate({ status: "in_progress" })}
              disabled={!canBulkUpdate}
            >
              Mark in progress
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1"
              onClick={() => handleBulkUpdate({ status: "done" })}
              disabled={!canBulkUpdate}
            >
              Mark done
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1"
              onClick={() => handleBulkUpdate({ inbox: false })}
              disabled={!canBulkUpdate}
            >
              Process inbox
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1"
              onClick={() => handleBulkUpdate({ archivedAt: new Date().toISOString() })}
              disabled={!canBulkUpdate}
            >
              Archive
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1"
              onClick={handleDeleteSelected}
            >
              Delete
            </button>
          </div>
        ) : null}
        </div>
      ) : null}

      {hasWorkspaces ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="p-2"></th>
              <th className="p-2">Task</th>
              <th className="p-2">Workspace</th>
              <th className="p-2">Project</th>
              <th className="p-2">Status</th>
              <th className="p-2">Priority</th>
              <th className="p-2">Type</th>
              <th className="p-2">Due</th>
              <th className="p-2">Reminders</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task) => (
              <tr key={task.id} className="border-t border-zinc-100">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(task.id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds((prev) => [...prev, task.id]);
                      } else {
                        setSelectedIds((prev) => prev.filter((id) => id !== task.id));
                      }
                    }}
                  />
                </td>
                <td className="p-2">
                  <div className="font-medium">{task.title}</div>
                  {task.tags.length ? (
                    <div className="text-xs text-zinc-500">{task.tags.join(", ")}</div>
                  ) : null}
                </td>
                <td className="p-2">{task.workspaceName}</td>
                <td className="p-2">{task.projectName}</td>
                <td className="p-2 capitalize">{task.status.replace("_", " ")}</td>
                <td className="p-2">{task.priority}</td>
                <td className="p-2">{task.type}</td>
                <td className="p-2">{task.dueDate ? task.dueDate.slice(0, 10) : "-"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      className="rounded-md border border-zinc-200 px-2 py-1"
                      onClick={() => {
                        const input = window.prompt("Reminder time (YYYY-MM-DDTHH:mm)");
                        if (input) addReminder(task, input);
                      }}
                    >
                      Add
                    </button>
                    {task.dueDate ? (
                      <button
                        type="button"
                        className="rounded-md border border-zinc-200 px-2 py-1"
                        onClick={() => {
                          const dueDate = task.dueDate;
                          if (!dueDate) return;
                          const due = new Date(dueDate);
                          due.setDate(due.getDate() - 1);
                          addReminder(task, due.toISOString());
                        }}
                      >
                        Smart
                      </button>
                    ) : null}
                    {task.reminders.length > 0 ? (
                      <>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 px-2 py-1"
                          onClick={() => snoozeReminder(task.reminders[0].id, 30)}
                        >
                          Snooze 30m
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 px-2 py-1"
                          onClick={() => completeReminder(task.reminders[0].id)}
                        >
                          Done
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : null}
    </section>
  );
}
