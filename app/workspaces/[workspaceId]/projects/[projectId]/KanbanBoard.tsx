"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Status = "todo" | "in_progress" | "done";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  order: number;
  assigneeId: string | null;
  dueDate: string | null;
  startDate: string | null;
  durationMinutes: number | null;
  priority: number;
  type: string;
  inbox: boolean;
  recurrenceRule: string | null;
  recurrenceTimezone: string | null;
  recurrenceExceptions: string[] | null;
  recurrenceEndAt: string | null;
  blocked: boolean;
  dependencyIds: string[];
  watcherIds: string[];
  tagIds: string[];
  tags: Array<{ id: string; name: string; color: string | null }>;
};

type Member = {
  userId: string;
  name: string;
  email: string;
  role: string;
};

type Tag = {
  id: string;
  name: string;
  color: string | null;
};

type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
};

type TaskActivity = {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string };
};


const COLUMNS: Array<{ key: Status; title: string }> = [
  { key: "todo", title: "Todo" },
  { key: "in_progress", title: "In Progress" },
  { key: "done", title: "Done" },
];

function groupTasks(tasks: Task[]) {
  const cols: Record<Status, Task[]> = { todo: [], in_progress: [], done: [] };
  for (const t of tasks) cols[t.status].push(t);
  for (const k of Object.keys(cols) as Status[]) cols[k].sort((a, b) => a.order - b.order);
  return cols;
}

function formatActivity(activity: TaskActivity) {
  const data = activity.data ?? {};
  if (activity.type === "created") return "created the task";
  if (activity.type === "edited") {
    const changed = Array.isArray((data as { changed?: string[] }).changed)
      ? (data as { changed?: string[] }).changed!.join(", ")
      : "details";
    return `edited ${changed}`;
  }
  if (activity.type === "assigned") {
    const to = (data as { to?: string | null }).to ?? null;
    return to ? "assigned the task" : "unassigned the task";
  }
  if (activity.type === "moved") {
    const fromStatus = (data as { fromStatus?: string }).fromStatus ?? "unknown";
    const toStatus = (data as { toStatus?: string }).toStatus ?? "unknown";
    return `moved from ${fromStatus} to ${toStatus}`;
  }
  return activity.type;
}

export default function KanbanBoard({
  workspaceId,
  projectId,
  currentUserId,
  initialTasks,
  availableTags,
  members,
}: {
  workspaceId: string;
  projectId: string;
  currentUserId: string;
  initialTasks: Task[];
  availableTags: Tag[];
  members: Member[];
}) {
  const initial = useMemo(() => groupTasks(initialTasks), [initialTasks]);
  const [columns, setColumns] = useState<Record<Status, Task[]>>(initial);
  const [drag, setDrag] = useState<{ taskId: string; from: Status } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: Status; index: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [checklistItems, setChecklistItems] = useState<
    Array<{ id: string; title: string; completedAt: string | null }>
  >([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [taskReminders, setTaskReminders] = useState<
    Array<{ id: string; remindAt: string; snoozedUntil: string | null; completedAt: string | null }>
  >([]);
  const [reminderInput, setReminderInput] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | "me" | "unassigned">("all");
  const [statusFilter, setStatusFilter] = useState<Record<Status, boolean>>({
    todo: true,
    in_progress: true,
    done: true,
  });
  const [priorityMin, setPriorityMin] = useState(0);
  const [priorityMax, setPriorityMax] = useState(5);
  const [dueDateFilter, setDueDateFilter] = useState<"all" | "overdue" | "this_week">("all");
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestVersionRef = useRef(0);
  const inFlightVersionRef = useRef(0);
  const dragRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkState, setBulkState] = useState<{
    status: Status | "";
    assigneeId: string | "";
    priority: string;
    dueDate: string;
    blocked: boolean;
    blockedEnabled: boolean;
  }>({
    status: "",
    assigneeId: "",
    priority: "",
    dueDate: "",
    blocked: false,
    blockedEnabled: false,
  });
  const [formState, setFormState] = useState<{
    title: string;
    description: string;
    dueDate: string;
    startDate: string;
    durationMinutes: string;
    priority: string;
    type: string;
    inbox: boolean;
    recurrenceRule: string;
    recurrenceTimezone: string;
    recurrenceExceptions: string;
    recurrenceEndAt: string;
    assigneeId: string;
    blocked: boolean;
    dependencyIds: string[];
    watcherIds: string[];
    tagIds: string[];
  }>({
    title: "",
    description: "",
    dueDate: "",
    startDate: "",
    durationMinutes: "",
    priority: "0",
    type: "action",
    inbox: false,
    recurrenceRule: "",
    recurrenceTimezone: "UTC",
    recurrenceExceptions: "",
    recurrenceEndAt: "",
    assigneeId: "",
    blocked: false,
    dependencyIds: [],
    watcherIds: [],
    tagIds: [],
  });
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; url: string; createdAt: string }>
  >([]);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const save = (nextCols: Record<Status, Task[]>) => {
    const payload = {
      workspaceId,
      projectId,
      columns: {
        todo: nextCols.todo.map((t) => t.id),
        in_progress: nextCols.in_progress.map((t) => t.id),
        done: nextCols.done.map((t) => t.id),
      },
    };

    setErr(null);
    latestVersionRef.current += 1;
    const version = latestVersionRef.current;
    setHasUnsaved(true);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void persistReorder(payload, version);
    }, 600);
  };

  const persistReorder = async (payload: {
    workspaceId: string;
    projectId: string;
    columns: Record<Status, string[]>;
  }, version: number) => {
    if (version < latestVersionRef.current) {
      return;
    }

    inFlightVersionRef.current = version;
    setIsSaving(true);

    const delays = [0, 400, 800, 1600];
    let lastError: string | null = null;

    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (version < latestVersionRef.current) {
        setIsSaving(false);
        return;
      }
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }

      try {
        const res = await fetch("/api/tasks/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          lastError = data.error ?? "Failed to save order";
          continue;
        }

        if (version === latestVersionRef.current) {
          setHasUnsaved(false);
          setErr(null);
        }
        setIsSaving(false);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Failed to save order";
      }
    }

    if (version === latestVersionRef.current) {
      setErr(lastError ?? "Failed to save order");
      setHasUnsaved(true);
    }
    setIsSaving(false);
  };

  const handleDrop = (to: Status, rawIndex: number) => {
    if (!drag) return;

    const from = drag.from;
    const fromList = columns[from];
    const fromIndex = fromList.findIndex((t) => t.id === drag.taskId);
    if (fromIndex === -1) {
      setDrag(null);
      return;
    }

    // If dropping on itself in same column, do nothing
    if (from === to && fromIndex === rawIndex) {
      setDrag(null);
      return;
    }

    // Remove task
    const task = fromList[fromIndex];
    const next: Record<Status, Task[]> = {
      todo: columns.todo.slice(),
      in_progress: columns.in_progress.slice(),
      done: columns.done.slice(),
    };
    next[from] = next[from].filter((t) => t.id !== task.id);

    // Adjust insertion index if moving within same column downward
    let index = rawIndex;
    if (from === to && fromIndex < index) index -= 1;

    const toList = next[to].slice();
    const clamped = Math.max(0, Math.min(index, toList.length));
    toList.splice(clamped, 0, { ...task, status: to });
    next[to] = toList;

    setColumns(next);
    setDrag(null);
    setDropTarget(null);
    save(next);
  };

  const findTask = (taskId: string) => {
    for (const key of ["todo", "in_progress", "done"] as const) {
      const hit = columns[key].find((t) => t.id === taskId);
      if (hit) return hit;
    }
    return null;
  };

  const closeDetails = () => {
    setDetailsTaskId(null);
    setModalErr(null);
    setComments([]);
    setActivity([]);
    setCommentText("");
    setAttachments([]);
    setAttachmentName("");
    setAttachmentUrl("");
    setChecklistItems([]);
    setNewChecklistItem("");
    setTaskReminders([]);
    setReminderInput("");
  };

  const openEdit = (taskId: string) => {
    const task = findTask(taskId);
    if (!task) return;
    setDetailsTaskId(taskId);
    setModalErr(null);
    setFormState({
      title: task.title,
      description: task.description ?? "",
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      startDate: task.startDate ? task.startDate.slice(0, 16) : "",
      durationMinutes: task.durationMinutes ? String(task.durationMinutes) : "",
      priority: String(task.priority ?? 0),
      type: task.type ?? "action",
      inbox: task.inbox ?? false,
      recurrenceRule: task.recurrenceRule ?? "",
      recurrenceTimezone: task.recurrenceTimezone ?? "UTC",
      recurrenceExceptions: task.recurrenceExceptions ? task.recurrenceExceptions.join(", ") : "",
      recurrenceEndAt: task.recurrenceEndAt ? task.recurrenceEndAt.slice(0, 16) : "",
      assigneeId: task.assigneeId ?? "",
      blocked: task.blocked,
      dependencyIds: task.dependencyIds ?? [],
      watcherIds: task.watcherIds ?? [],
      tagIds: task.tagIds ?? [],
    });
  };

  const updateTaskOptimistic = (taskId: string, updates: Partial<Task>) => {
    setColumns((prev) => {
      const next = {
        todo: prev.todo.map((x) => ({ ...x })),
        in_progress: prev.in_progress.map((x) => ({ ...x })),
        done: prev.done.map((x) => ({ ...x })),
      };
      for (const key of ["todo", "in_progress", "done"] as const) {
        next[key] = next[key].map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        );
      }
      return next;
    });
  };

  const validateForm = () => {
    const title = formState.title.trim();
    if (!title) return "Title is required.";
    if (title.length > 120) return "Title must be 120 characters or fewer.";
    if (formState.description.length > 1000) return "Description must be 1000 characters or fewer.";
    const priority = Number(formState.priority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 5) {
      return "Priority must be an integer between 0 and 5.";
    }
    if (formState.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(formState.dueDate)) {
      return "Due date must be a valid date.";
    }
    if (formState.startDate && Number.isNaN(new Date(formState.startDate).getTime())) {
      return "Start date must be a valid datetime.";
    }
    if (formState.durationMinutes) {
      const duration = Number(formState.durationMinutes);
      if (!Number.isInteger(duration) || duration < 0) {
        return "Duration must be a positive number.";
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!detailsTaskId) return;
    const validationError = validateForm();
    if (validationError) {
      setModalErr(validationError);
      return;
    }

    const current = findTask(detailsTaskId);
    if (!current) return;

    const payload = {
      workspaceId,
      projectId,
      taskId: detailsTaskId,
      title: formState.title.trim(),
      description: formState.description.trim() || null,
      dueDate: formState.dueDate || null,
      startDate: formState.startDate || null,
      durationMinutes: formState.durationMinutes ? Number(formState.durationMinutes) : null,
      priority: Number(formState.priority),
      type: formState.type,
      inbox: formState.inbox,
      recurrenceRule: formState.recurrenceRule || null,
      recurrenceTimezone: formState.recurrenceTimezone || "UTC",
      recurrenceExceptions: formState.recurrenceExceptions
        ? formState.recurrenceExceptions.split(",").map((value) => value.trim()).filter(Boolean)
        : [],
      recurrenceEndAt: formState.recurrenceEndAt || null,
      assigneeId: formState.assigneeId || null,
      blocked: formState.blocked,
      dependencyIds: formState.dependencyIds,
      watcherIds: formState.watcherIds,
      tagIds: formState.tagIds,
    };

    const previous = { ...current };
    updateTaskOptimistic(detailsTaskId, {
      title: payload.title,
      description: payload.description,
      dueDate: payload.dueDate,
      startDate: payload.startDate,
      durationMinutes: payload.durationMinutes,
      priority: payload.priority,
      type: payload.type,
      inbox: payload.inbox,
      recurrenceRule: payload.recurrenceRule,
      recurrenceTimezone: payload.recurrenceTimezone,
      recurrenceExceptions: payload.recurrenceExceptions,
      recurrenceEndAt: payload.recurrenceEndAt,
      assigneeId: payload.assigneeId,
      blocked: payload.blocked,
      dependencyIds: payload.dependencyIds,
      watcherIds: payload.watcherIds,
      tagIds: payload.tagIds,
    });

    setModalErr(null);
    const res = await fetch("/api/tasks/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      updateTaskOptimistic(detailsTaskId, previous);
      setModalErr(data.error ?? "Failed to update task.");
      return;
    }

    closeDetails();
  };

  const activeTask = detailsTaskId ? findTask(detailsTaskId) : null;
  const allTasks = useMemo(
    () => [...columns.todo, ...columns.in_progress, ...columns.done],
    [columns]
  );

  const toggleSelected = (taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const clearSelected = () => {
    setSelectedIds([]);
  };

  const applyBulk = async () => {
    if (selectedIds.length === 0) return;
    const updates: Record<string, unknown> = {};
    if (bulkState.status) updates.status = bulkState.status;
    if (bulkState.assigneeId !== "") {
      updates.assigneeId = bulkState.assigneeId === "__unassigned__" ? null : bulkState.assigneeId;
    }
    if (bulkState.priority !== "") updates.priority = Number(bulkState.priority);
    if (bulkState.dueDate !== "") updates.dueDate = bulkState.dueDate || null;
    if (bulkState.blockedEnabled) updates.blocked = bulkState.blocked;

    if (Object.keys(updates).length === 0) return;

    setErr(null);
    const previous = columns;
    let nextCols = columns;

    if (updates.status) {
      const target = updates.status as Status;
      nextCols = {
        todo: columns.todo.filter((t) => !selectedIds.includes(t.id)),
        in_progress: columns.in_progress.filter((t) => !selectedIds.includes(t.id)),
        done: columns.done.filter((t) => !selectedIds.includes(t.id)),
      };
      const movedTasks = allTasks.filter((t) => selectedIds.includes(t.id)).map((t) => ({
        ...t,
        status: target,
      }));
      nextCols[target] = [...nextCols[target], ...movedTasks];
    }

    if (updates.assigneeId !== undefined || updates.priority !== undefined || updates.dueDate !== undefined || updates.blocked !== undefined) {
      nextCols = {
        todo: nextCols.todo.map((t) =>
          selectedIds.includes(t.id)
            ? {
                ...t,
                assigneeId: updates.assigneeId !== undefined ? (updates.assigneeId as string | null) : t.assigneeId,
                priority: updates.priority !== undefined ? (updates.priority as number) : t.priority,
                dueDate: updates.dueDate !== undefined ? (updates.dueDate as string | null) : t.dueDate,
                blocked: updates.blocked !== undefined ? (updates.blocked as boolean) : t.blocked,
              }
            : t
        ),
        in_progress: nextCols.in_progress.map((t) =>
          selectedIds.includes(t.id)
            ? {
                ...t,
                assigneeId: updates.assigneeId !== undefined ? (updates.assigneeId as string | null) : t.assigneeId,
                priority: updates.priority !== undefined ? (updates.priority as number) : t.priority,
                dueDate: updates.dueDate !== undefined ? (updates.dueDate as string | null) : t.dueDate,
                blocked: updates.blocked !== undefined ? (updates.blocked as boolean) : t.blocked,
              }
            : t
        ),
        done: nextCols.done.map((t) =>
          selectedIds.includes(t.id)
            ? {
                ...t,
                assigneeId: updates.assigneeId !== undefined ? (updates.assigneeId as string | null) : t.assigneeId,
                priority: updates.priority !== undefined ? (updates.priority as number) : t.priority,
                dueDate: updates.dueDate !== undefined ? (updates.dueDate as string | null) : t.dueDate,
                blocked: updates.blocked !== undefined ? (updates.blocked as boolean) : t.blocked,
              }
            : t
        ),
      };
    }

    setColumns(nextCols);
    if (updates.status) save(nextCols);

    const res = await fetch("/api/tasks/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        projectId,
        taskIds: selectedIds,
        updates,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed to apply bulk update.");
      setColumns(previous);
      return;
    }

    clearSelected();
    setBulkState({
      status: "",
      assigneeId: "",
      priority: "",
      dueDate: "",
      blocked: false,
      blockedEnabled: false,
    });
  };

  const filtersActive =
    assigneeFilter !== "all" ||
    dueDateFilter !== "all" ||
    priorityMin !== 0 ||
    priorityMax !== 5 ||
    !Object.values(statusFilter).every(Boolean);
  const canDrag = !filtersActive;

  const filteredColumns = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const matches = (task: Task) => {
      if (!statusFilter[task.status]) return false;
      if (assigneeFilter === "me" && task.assigneeId !== currentUserId) return false;
      if (assigneeFilter === "unassigned" && task.assigneeId) return false;
      if (task.priority < priorityMin || task.priority > priorityMax) return false;
      if (dueDateFilter !== "all") {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        if (Number.isNaN(due.getTime())) return false;
        if (dueDateFilter === "overdue") {
          if (due >= today) return false;
        }
        if (dueDateFilter === "this_week") {
          if (due < today || due > weekEnd) return false;
        }
      }
      return true;
    };

    return {
      todo: columns.todo.filter(matches),
      in_progress: columns.in_progress.filter(matches),
      done: columns.done.filter(matches),
    };
  }, [
    columns,
    assigneeFilter,
    currentUserId,
    dueDateFilter,
    priorityMax,
    priorityMin,
    statusFilter,
  ]);

  useEffect(() => {
    if (!detailsTaskId) return;
    setIsLoadingDetails(true);
    setModalErr(null);
    void (async () => {
      try {
        const query = new URLSearchParams({
          workspaceId,
          projectId,
          taskId: detailsTaskId,
        });
        const [commentsRes, activityRes] = await Promise.all([
          fetch(`/api/tasks/comments?${query.toString()}`),
          fetch(`/api/tasks/activity?${query.toString()}`),
        ]);
        if (!commentsRes.ok) {
          const data = await commentsRes.json().catch(() => ({}));
          setModalErr(data.error ?? "Failed to load comments.");
          return;
        }
        if (!activityRes.ok) {
          const data = await activityRes.json().catch(() => ({}));
          setModalErr(data.error ?? "Failed to load activity.");
          return;
        }
        const commentsJson = await commentsRes.json();
        const activityJson = await activityRes.json();
        setComments(commentsJson.comments ?? []);
        setActivity(activityJson.activity ?? []);
        const attachmentsRes = await fetch(`/api/tasks/attachments?${query.toString()}`);
        if (attachmentsRes.ok) {
          const attachmentsJson = await attachmentsRes.json();
          setAttachments(attachmentsJson.attachments ?? []);
        }
        const [checklistRes, remindersRes] = await Promise.all([
          fetch(`/api/tasks/checklist?${query.toString()}`),
          fetch(`/api/tasks/reminders?${query.toString()}`),
        ]);
        if (checklistRes.ok) {
          const checklistJson = await checklistRes.json();
          setChecklistItems(checklistJson.items ?? []);
        }
        if (remindersRes.ok) {
          const remindersJson = await remindersRes.json();
          setTaskReminders(remindersJson.reminders ?? []);
        }
      } finally {
        setIsLoadingDetails(false);
      }
    })();
  }, [detailsTaskId, projectId, workspaceId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleAddComment = async () => {
    if (!detailsTaskId) return;
    const body = commentText.trim();
    if (!body) {
      setModalErr("Comment cannot be empty.");
      return;
    }
    if (body.length > 1000) {
      setModalErr("Comment must be 1000 characters or fewer.");
      return;
    }
    setModalErr(null);
    const res = await fetch("/api/tasks/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        projectId,
        taskId: detailsTaskId,
        body,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setModalErr(data.error ?? "Failed to add comment.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.comment) {
      setComments((prev) => [...prev, data.comment]);
    }
    setCommentText("");
  };

  const handleAddAttachment = async () => {
    if (!detailsTaskId) return;
    const name = attachmentName.trim();
    const url = attachmentUrl.trim();
    if (!name || !url) {
      setModalErr("Attachment name and URL are required.");
      return;
    }
    setModalErr(null);
    const res = await fetch("/api/tasks/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        projectId,
        taskId: detailsTaskId,
        name,
        url,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setModalErr(data.error ?? "Failed to add attachment.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.attachment) {
      setAttachments((prev) => [...prev, data.attachment]);
    }
    setAttachmentName("");
    setAttachmentUrl("");
  };

  const handleAddChecklistItem = async () => {
    if (!detailsTaskId) return;
    const title = newChecklistItem.trim();
    if (!title) return;
    const res = await fetch("/api/tasks/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, taskId: detailsTaskId, title }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (data.item) {
      setChecklistItems((prev) => [...prev, data.item]);
      setNewChecklistItem("");
    }
  };

  const toggleChecklistItem = async (itemId: string, completed: boolean) => {
    const res = await fetch("/api/tasks/checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, completed }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (data.item) {
      setChecklistItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, completedAt: data.item.completedAt } : item))
      );
    }
  };

  const deleteChecklistItem = async (itemId: string) => {
    await fetch(`/api/tasks/checklist?id=${itemId}`, { method: "DELETE" });
    setChecklistItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleAddReminder = async () => {
    if (!detailsTaskId) return;
    if (!reminderInput) return;
    const res = await fetch("/api/tasks/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, taskId: detailsTaskId, remindAt: reminderInput }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (data.reminder) {
      setTaskReminders((prev) => [...prev, data.reminder]);
      setReminderInput("");
    }
  };

  const snoozeReminder = async (reminderId: string, minutes: number) => {
    const res = await fetch("/api/tasks/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderId, snoozeMinutes: minutes }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (data.reminder) {
      setTaskReminders((prev) =>
        prev.map((item) => (item.id === reminderId ? data.reminder : item))
      );
    }
  };

  const completeReminder = async (reminderId: string) => {
    const res = await fetch("/api/tasks/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderId, complete: true }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (data.reminder) {
      setTaskReminders((prev) =>
        prev.map((item) => (item.id === reminderId ? data.reminder : item))
      );
    }
  };

  const handleArchiveTask = async () => {
    if (!detailsTaskId) return;
    await fetch("/api/tasks/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, taskId: detailsTaskId }),
    });
    closeDetails();
  };

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-red-600">{err}</p>}
      {isSaving && <p className="text-sm text-zinc-500">Saving…</p>}
      {hasUnsaved ? <p className="text-sm text-zinc-500">Unsaved changes</p> : null}
      {filtersActive ? (
        <p className="text-sm text-zinc-500">Filters active: drag & drop disabled.</p>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium">
              Selected: <span className="font-semibold">{selectedIds.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                onClick={clearSelected}
              >
                Clear
              </button>
              <button
                className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                onClick={applyBulk}
              >
                Apply
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase text-zinc-500">Status</span>
              <select
                value={bulkState.status}
                onChange={(e) => setBulkState((s) => ({ ...s, status: e.target.value as Status | "" }))}
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">No change</option>
                {COLUMNS.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-semibold uppercase text-zinc-500">Assignee</span>
              <select
                value={bulkState.assigneeId}
                onChange={(e) => setBulkState((s) => ({ ...s, assigneeId: e.target.value }))}
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">No change</option>
                <option value="__unassigned__">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-semibold uppercase text-zinc-500">Priority</span>
              <input
                type="number"
                min={0}
                max={5}
                value={bulkState.priority}
                onChange={(e) => setBulkState((s) => ({ ...s, priority: e.target.value }))}
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="No change"
              />
            </label>

            <label className="text-sm">
              <span className="text-xs font-semibold uppercase text-zinc-500">Due date</span>
              <input
                type="date"
                value={bulkState.dueDate}
                onChange={(e) => setBulkState((s) => ({ ...s, dueDate: e.target.value }))}
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bulkState.blockedEnabled}
                onChange={(e) => setBulkState((s) => ({ ...s, blockedEnabled: e.target.checked }))}
              />
              Apply blocked status
            </label>

            {bulkState.blockedEnabled ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bulkState.blocked}
                  onChange={(e) => setBulkState((s) => ({ ...s, blocked: e.target.checked }))}
                />
                Blocked
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-4">
        <label>
          <span className="text-xs font-semibold uppercase text-zinc-500">Assignee</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value as "all" | "me" | "unassigned")}
            className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </label>

        <div>
          <div className="text-xs font-semibold uppercase text-zinc-500">Status</div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {COLUMNS.map((col) => (
              <label key={col.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={statusFilter[col.key]}
                  onChange={() =>
                    setStatusFilter((prev) => ({ ...prev, [col.key]: !prev[col.key] }))
                  }
                />
                {col.title}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase text-zinc-500">Priority</div>
          <div className="mt-2 flex gap-2">
            <Input
              type="number"
              min={0}
              max={5}
              value={priorityMin}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isNaN(next)) return;
                setPriorityMin(Math.min(next, priorityMax));
              }}
            />
            <Input
              type="number"
              min={0}
              max={5}
              value={priorityMax}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isNaN(next)) return;
                setPriorityMax(Math.max(next, priorityMin));
              }}
            />
          </div>
        </div>

        <label>
          <span className="text-xs font-semibold uppercase text-zinc-500">Due date</span>
          <select
            value={dueDateFilter}
            onChange={(e) => setDueDateFilter(e.target.value as "all" | "overdue" | "this_week")}
            className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
            <option value="this_week">This week</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          if (!statusFilter[col.key]) return null;
          const list = filteredColumns[col.key];

          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (!canDrag) return;
                e.preventDefault();
                if (drag) setDropTarget({ status: col.key, index: list.length });
              }}
              onDrop={(e) => {
                if (!canDrag) return;
                e.preventDefault();
                if (!drag || !dropTarget) return;
                // drop at end of column
                handleDrop(col.key, dropTarget.index);
              }}
              onDragLeave={() => {
                if (dropTarget?.status === col.key) setDropTarget(null);
              }}
              className="min-h-[300px] rounded-xl border border-zinc-200 bg-white p-4"
            >
              <h3 className="text-base font-semibold">{col.title}</h3>

              <div className="mt-3 flex flex-col gap-3">
                {list.map((t, idx) => (
                  <div key={t.id}>
                    {canDrag &&
                    dropTarget &&
                    drag &&
                    dropTarget.status === col.key &&
                    dropTarget.index === idx ? (
                      <div
                        className="mb-2 h-0.5 rounded bg-zinc-900/60"
                      />
                    ) : null}
                    <div
                      draggable={canDrag}
                      onDragStart={() => {
                        if (!canDrag) return;
                        dragRef.current = true;
                        setDrag({ taskId: t.id, from: col.key });
                        setDropTarget({ status: col.key, index: idx });
                      }}
                      onDragEnd={() => {
                        if (!canDrag) return;
                        dragRef.current = false;
                        setDrag(null);
                        setDropTarget(null);
                      }}
                      onClick={() => {
                        if (dragRef.current) return;
                      }}
                      onDragOver={(e) => {
                        if (!canDrag) return;
                        e.preventDefault();
                        if (drag) setDropTarget({ status: col.key, index: idx });
                      }}
                      onDrop={(e) => {
                        if (!canDrag) return;
                        e.preventDefault();
                        e.stopPropagation(); // CRITICAL: prevents also triggering the column onDrop
                        dragRef.current = false;
                        handleDrop(col.key, idx); // insert before this card
                      }}
                      className={`rounded-lg border p-3 shadow-sm transition ${
                        drag?.taskId === t.id
                          ? "border-dashed border-zinc-400 bg-zinc-100 opacity-70"
                          : "border-zinc-200 bg-white"
                      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                      title="Drag me"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{t.title}</div>
                        {t.blocked ||
                        t.dependencyIds.some((depId) => findTask(depId)?.status !== "done") ? (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                            Blocked
                          </span>
                        ) : null}
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggleSelected(t.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        Select
                      </label>
                      {t.description ? (
                        <div className="mt-1 text-sm text-zinc-600">{t.description}</div>
                      ) : null}

                      <div className="mt-3 space-y-2">
                      {t.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {t.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-600"
                              style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <select
                          value={t.assigneeId ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                          const raw = e.target.value;
                          const newAssigneeId = raw === "__unassigned__" ? null : raw || null;

                          // update UI immediately
                          updateTaskOptimistic(t.id, { assigneeId: newAssigneeId });

                          const res = await fetch("/api/tasks/assign", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                              workspaceId,
                              projectId,
                              taskId: t.id,
                              assigneeId: newAssigneeId,
                              }),
                          });

                          if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              setErr(data.error ?? "Failed to assign");
                          }
                          }}
                          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm"
                      >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                              {m.name}
                          </option>
                          ))}
                      </select>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(t.id);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                      </div>
                    </div>
                  </div>
                ))}
                {canDrag &&
                dropTarget &&
                drag &&
                dropTarget.status === col.key &&
                dropTarget.index === list.length ? (
                  <div
                    className="mt-2 h-0.5 rounded bg-zinc-900/60"
                  />
                ) : null}

                {list.length === 0 ? (
                  <div className="text-sm text-zinc-500">No tasks</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-zinc-500">
        Tip: drop onto a card to insert above it, or drop into a column to append.
      </p>

      {activeTask ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeDetails}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Edit task</h3>
                {activeTask ? (
                  <p className="text-sm text-zinc-500">{activeTask.title}</p>
                ) : null}
              </div>
              <Button type="button" variant="outline" onClick={closeDetails}>
                Close
              </Button>
            </div>

            <div className="mt-4 grid gap-4">
              <label>
                <span className="text-sm font-medium">Title</span>
                <Input
                  value={formState.title}
                  onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))}
                />
              </label>

              <label>
                <span className="text-sm font-medium">Description</span>
                <Textarea
                  value={formState.description}
                  onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
                  rows={4}
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="text-sm font-medium">Due date</span>
                  <Input
                    type="date"
                    value={formState.dueDate}
                    onChange={(e) => setFormState((s) => ({ ...s, dueDate: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="text-sm font-medium">Priority (0-5)</span>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    value={formState.priority}
                    onChange={(e) => setFormState((s) => ({ ...s, priority: e.target.value }))}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="text-sm font-medium">Start date</span>
                  <Input
                    type="datetime-local"
                    value={formState.startDate}
                    onChange={(e) => setFormState((s) => ({ ...s, startDate: e.target.value }))}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium">Duration (minutes)</span>
                  <Input
                    type="number"
                    min={0}
                    value={formState.durationMinutes}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, durationMinutes: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="text-sm font-medium">Task type</span>
                  <select
                    value={formState.type}
                    onChange={(e) => setFormState((s) => ({ ...s, type: e.target.value }))}
                    className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="action">Action</option>
                    <option value="bug">Bug</option>
                    <option value="call">Call</option>
                    <option value="follow_up">Meeting follow-up</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formState.inbox}
                    onChange={(e) => setFormState((s) => ({ ...s, inbox: e.target.checked }))}
                  />
                  Inbox
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="text-sm font-medium">Recurrence rule</span>
                  <Input
                    value={formState.recurrenceRule}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, recurrenceRule: e.target.value }))
                    }
                    placeholder="RRULE:FREQ=WEEKLY;BYDAY=MO"
                  />
                </label>
                <label>
                  <span className="text-sm font-medium">Recurrence end</span>
                  <Input
                    type="datetime-local"
                    value={formState.recurrenceEndAt}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, recurrenceEndAt: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="text-sm font-medium">Recurrence timezone</span>
                  <Input
                    value={formState.recurrenceTimezone}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, recurrenceTimezone: e.target.value }))
                    }
                    placeholder="UTC"
                  />
                </label>
                <label>
                  <span className="text-sm font-medium">Exceptions (YYYY-MM-DD)</span>
                  <Input
                    value={formState.recurrenceExceptions}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, recurrenceExceptions: e.target.value }))
                    }
                    placeholder="2025-01-10, 2025-02-10"
                  />
                </label>
              </div>

              <label>
                <span className="text-sm font-medium">Assignee</span>
                <select
                  value={formState.assigneeId}
                  onChange={(e) => setFormState((s) => ({ ...s, assigneeId: e.target.value }))}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-sm font-medium">Watchers</span>
                <select
                  multiple
                  value={formState.watcherIds}
                  onChange={(e) => {
                    const next = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setFormState((s) => ({ ...s, watcherIds: next }));
                  }}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">Hold Ctrl/Cmd to select multiple.</p>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formState.blocked}
                  onChange={(e) => setFormState((s) => ({ ...s, blocked: e.target.checked }))}
                />
                Blocked
              </label>

              <label>
                <span className="text-sm font-medium">Dependencies</span>
                <select
                  multiple
                  value={formState.dependencyIds}
                  onChange={(e) => {
                    const next = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setFormState((s) => ({ ...s, dependencyIds: next }));
                  }}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  {allTasks
                    .filter((task) => task.id !== detailsTaskId)
                    .map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">Hold Ctrl/Cmd to select multiple.</p>
              </label>

              <label>
                <span className="text-sm font-medium">Tags</span>
                <select
                  multiple
                  value={formState.tagIds}
                  onChange={(e) => {
                    const next = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setFormState((s) => ({ ...s, tagIds: next }));
                  }}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">Hold Ctrl/Cmd to select multiple.</p>
              </label>

              {modalErr ? <p className="text-sm text-red-600">{modalErr}</p> : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="destructive" onClick={handleArchiveTask}>
                  Archive/Delete
                </Button>
                <Button type="button" variant="outline" onClick={closeDetails}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave}>
                  Save changes
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-base font-semibold">Comments</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment"
                />
                <Button type="button" onClick={handleAddComment}>
                  Post
                </Button>
              </div>
              {isLoadingDetails ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-zinc-500">No comments yet.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-lg border border-zinc-200 p-3">
                      <div className="text-sm font-semibold">{c.author.name}</div>
                      <div className="text-xs text-zinc-500">
                        {new Date(c.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-2 text-sm">{c.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              <h4 className="text-base font-semibold">Attachments</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder="Name"
                />
                <Input
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://..."
                />
                <Button type="button" onClick={handleAddAttachment}>
                  Add
                </Button>
              </div>
              {attachments.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No attachments yet.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {attachments.map((att) => (
                    <li key={att.id}>
                      <a href={att.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {att.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6">
              <h4 className="text-base font-semibold">Checklist</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Checklist item"
                />
                <Button type="button" onClick={handleAddChecklistItem}>
                  Add
                </Button>
              </div>
              {checklistItems.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No checklist items yet.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {checklistItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(item.completedAt)}
                          onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                        />
                        <span className={item.completedAt ? "line-through text-zinc-400" : ""}>
                          {item.title}
                        </span>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        className="px-2 py-1 text-xs"
                        onClick={() => deleteChecklistItem(item.id)}
                      >
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6">
              <h4 className="text-base font-semibold">Reminders</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  type="datetime-local"
                  value={reminderInput}
                  onChange={(e) => setReminderInput(e.target.value)}
                />
                <Button type="button" onClick={handleAddReminder}>
                  Add reminder
                </Button>
                {activeTask?.dueDate ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const due = new Date(activeTask.dueDate as string);
                      due.setDate(due.getDate() - 1);
                      setReminderInput(due.toISOString().slice(0, 16));
                    }}
                  >
                    Smart -1 day
                  </Button>
                ) : null}
              </div>
              {taskReminders.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No reminders yet.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {taskReminders.map((reminder) => (
                    <li key={reminder.id} className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {new Date(reminder.remindAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {reminder.completedAt ? "Completed" : reminder.snoozedUntil ? "Snoozed" : "Active"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="px-2 py-1 text-xs"
                          onClick={() => snoozeReminder(reminder.id, 30)}
                        >
                          Snooze 30m
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="px-2 py-1 text-xs"
                          onClick={() => completeReminder(reminder.id)}
                        >
                          Complete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6">
              <h4 className="text-base font-semibold">Activity</h4>
              {isLoadingDetails ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : activity.length === 0 ? (
                <p className="text-sm text-zinc-500">No activity yet.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {activity.map((a) => (
                    <div key={a.id} className="rounded-lg border border-zinc-200 p-3">
                      <div className="text-sm font-semibold">{a.actor.name}</div>
                      <div className="text-xs text-zinc-500">
                        {new Date(a.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-2 text-sm">{formatActivity(a)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
