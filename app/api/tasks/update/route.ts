import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";
import { maxLen, parseDateInput, parseDateTimeInput, parsePriority, requireTrimmed } from "@/lib/validation";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 1000;
const PRIORITY_MIN = 0;
const PRIORITY_MAX = 5;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = String(body.workspaceId ?? "");
  const projectId = String(body.projectId ?? "");
  const taskId = String(body.taskId ?? "");
  const titleResult = requireTrimmed(body.title, "Title is required");
  if (!titleResult.ok) return NextResponse.json({ error: titleResult.error }, { status: 400 });
  const title = titleResult.value;
  const description = body.description === null ? null : String(body.description ?? "");
  const startDateRaw = body.startDate === null ? null : String(body.startDate ?? "");
  const dueDateRaw = body.dueDate === null ? null : String(body.dueDate ?? "");
  const priorityRaw = body.priority;
  const assigneeId = body.assigneeId === null ? null : String(body.assigneeId ?? "");
  const blocked = Boolean(body.blocked);
  const type = body.type ? String(body.type) : "action";
  const inbox = body.inbox === undefined ? undefined : Boolean(body.inbox);
  const durationMinutes =
    body.durationMinutes === null || body.durationMinutes === undefined
      ? null
      : Number(body.durationMinutes);
  const archivedAt = body.archivedAt ? new Date(String(body.archivedAt)) : null;
  const recurrenceRule = body.recurrenceRule === null ? null : String(body.recurrenceRule ?? "");
  const recurrenceTimezone = body.recurrenceTimezone === null ? null : String(body.recurrenceTimezone ?? "");
  const recurrenceExceptions = body.recurrenceExceptions ?? null;
  const recurrenceEndAtRaw = body.recurrenceEndAt === null ? null : String(body.recurrenceEndAt ?? "");
  const dependencyIds: string[] = Array.isArray(body.dependencyIds)
    ? body.dependencyIds.map((id: unknown) => String(id)).filter(Boolean)
    : [];
  const tagIds: string[] = Array.isArray(body.tagIds)
    ? body.tagIds.map((id: unknown) => String(id)).filter(Boolean)
    : [];
  const watcherIds: string[] = Array.isArray(body.watcherIds)
    ? body.watcherIds.map((id: unknown) => String(id)).filter(Boolean)
    : [];
  const checklistItems: { title: string; completedAt: string | null }[] = Array.isArray(
    body.checklistItems
  )
    ? body.checklistItems
        .map((item: { title?: unknown; completedAt?: unknown }) => ({
          title: String(item.title ?? "").trim(),
          completedAt: item.completedAt ? String(item.completedAt) : null,
        }))
        .filter((item: { title: string }) => Boolean(item.title))
    : [];

  if (!workspaceId || !projectId || !taskId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const titleLen = maxLen(title, MAX_TITLE, `Title must be ${MAX_TITLE} characters or fewer`);
  if (!titleLen.ok) return NextResponse.json({ error: titleLen.error }, { status: 400 });
  if (description) {
    const descLen = maxLen(
      description,
      MAX_DESCRIPTION,
      `Description must be ${MAX_DESCRIPTION} characters or fewer`
    );
    if (!descLen.ok) return NextResponse.json({ error: descLen.error }, { status: 400 });
  }

  const priorityResult = parsePriority(priorityRaw, PRIORITY_MIN, PRIORITY_MAX);
  if (!priorityResult.ok) {
    return NextResponse.json({ error: priorityResult.error }, { status: 400 });
  }
  const priority = priorityResult.value;

  const dueDateResult = parseDateInput(dueDateRaw);
  if (!dueDateResult.ok) {
    return NextResponse.json({ error: dueDateResult.error }, { status: 400 });
  }
  const dueDate = dueDateResult.value;

  const startDateResult = parseDateTimeInput(startDateRaw);
  if (!startDateResult.ok) {
    return NextResponse.json({ error: startDateResult.error }, { status: 400 });
  }
  const startDate = startDateResult.value;

  const recurrenceEndAtResult = parseDateTimeInput(recurrenceEndAtRaw);
  if (!recurrenceEndAtResult.ok) {
    return NextResponse.json({ error: recurrenceEndAtResult.error }, { status: 400 });
  }
  const recurrenceEndAt = recurrenceEndAtResult.value;

  // current user must be in workspace
  const me = await getWorkspaceMember(workspaceId, session.user.id);
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, projectId },
    select: {
      id: true,
      title: true,
      description: true,
      startDate: true,
      dueDate: true,
      priority: true,
      type: true,
      durationMinutes: true,
      inbox: true,
      archivedAt: true,
      recurrenceRule: true,
      recurrenceTimezone: true,
      recurrenceExceptions: true,
      recurrenceEndAt: true,
      assigneeId: true,
      blocked: true,
      dependencies: { select: { dependsOnId: true } },
      tags: { select: { tagId: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const filteredDependencyIds: string[] = dependencyIds.filter((id) => id !== taskId);
  if (filteredDependencyIds.length > 0) {
    const dependencyTasks = await prisma.task.findMany({
      where: { id: { in: filteredDependencyIds }, workspaceId, projectId },
      select: { id: true },
    });
    if (dependencyTasks.length !== filteredDependencyIds.length) {
      return NextResponse.json({ error: "Invalid dependencies" }, { status: 400 });
    }
  }

  if (assigneeId) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
    });
    if (!member) return NextResponse.json({ error: "Assignee not in workspace" }, { status: 400 });
  }

  if (tagIds.length > 0) {
    const tagRecords = await prisma.tag.findMany({
      where: { id: { in: tagIds }, workspaceId },
      select: { id: true },
    });
    if (tagRecords.length !== tagIds.length) {
      return NextResponse.json({ error: "Invalid tags" }, { status: 400 });
    }
  }

  if (watcherIds.length > 0) {
    const watcherMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: watcherIds } },
      select: { userId: true },
    });
    if (watcherMembers.length !== watcherIds.length) {
      return NextResponse.json({ error: "Invalid watchers" }, { status: 400 });
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description,
      startDate,
      dueDate,
      priority,
      type,
      durationMinutes,
      inbox: inbox === undefined ? undefined : inbox,
      archivedAt,
      recurrenceRule: recurrenceRule || null,
      recurrenceTimezone: recurrenceTimezone || null,
      recurrenceExceptions: recurrenceExceptions ?? null,
      recurrenceEndAt,
      assigneeId: assigneeId || null,
      blocked,
      watchers: {
        deleteMany: {},
        ...(watcherIds.length > 0
          ? {
              createMany: {
                data: watcherIds.map((userId) => ({ userId })),
              },
            }
          : {}),
      },
      checklistItems: {
        deleteMany: {},
        ...(checklistItems.length > 0
          ? {
              createMany: {
                data: checklistItems.map((item, index) => ({
                  title: item.title,
                  order: index,
                  completedAt: item.completedAt ? new Date(item.completedAt) : null,
                })),
              },
            }
          : {}),
      },
      dependencies: {
        deleteMany: {},
        ...(filteredDependencyIds.length > 0
          ? {
              createMany: {
                data: filteredDependencyIds.map((dependsOnId: string) => ({
                  dependsOnId,
                  workspaceId,
                  projectId,
                })),
              },
            }
          : {}),
      },
      tags: {
        deleteMany: {},
        ...(tagIds.length > 0
          ? {
              createMany: {
                data: tagIds.map((tagId) => ({ tagId, workspaceId })),
              },
            }
          : {}),
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      startDate: true,
      dueDate: true,
      priority: true,
      type: true,
      durationMinutes: true,
      inbox: true,
      archivedAt: true,
      recurrenceRule: true,
      recurrenceTimezone: true,
      recurrenceExceptions: true,
      recurrenceEndAt: true,
      assigneeId: true,
      blocked: true,
      dependencies: { select: { dependsOnId: true } },
      tags: { select: { tagId: true } },
    },
  });

  const changedFields: string[] = [];
  if (task.title !== title) changedFields.push("title");
  if ((task.description ?? null) !== (description ?? null)) changedFields.push("description");
  if ((task.dueDate?.toISOString() ?? null) !== (dueDate?.toISOString() ?? null)) {
    changedFields.push("dueDate");
  }
  if ((task.startDate?.toISOString() ?? null) !== (startDate?.toISOString() ?? null)) {
    changedFields.push("startDate");
  }
  if (task.priority !== priority) changedFields.push("priority");
  if ((task as { type?: string }).type !== type) changedFields.push("type");
  if ((task as { durationMinutes?: number | null }).durationMinutes !== durationMinutes) {
    changedFields.push("durationMinutes");
  }
  if ((task as { inbox?: boolean }).inbox !== inbox) changedFields.push("inbox");
  if ((task as { archivedAt?: Date | null }).archivedAt?.toISOString() !== archivedAt?.toISOString()) {
    changedFields.push("archivedAt");
  }
  if ((task.assigneeId ?? null) !== (assigneeId ?? null)) changedFields.push("assigneeId");
  if (task.blocked !== blocked) changedFields.push("blocked");
  if ((task as { recurrenceRule?: string | null }).recurrenceRule !== recurrenceRule) {
    changedFields.push("recurrenceRule");
  }
  if ((task as { recurrenceTimezone?: string | null }).recurrenceTimezone !== recurrenceTimezone) {
    changedFields.push("recurrenceTimezone");
  }
  if (JSON.stringify((task as { recurrenceExceptions?: unknown }).recurrenceExceptions ?? null) !== JSON.stringify(recurrenceExceptions ?? null)) {
    changedFields.push("recurrenceExceptions");
  }
  if ((task as { recurrenceEndAt?: Date | null }).recurrenceEndAt?.toISOString() !== recurrenceEndAt?.toISOString()) {
    changedFields.push("recurrenceEndAt");
  }
  const previousDeps = task.dependencies.map((d: { dependsOnId: string }) => d.dependsOnId).sort();
  const nextDeps = filteredDependencyIds.slice().sort();
  if (previousDeps.join(",") !== nextDeps.join(",")) changedFields.push("dependencies");
  const previousTags = task.tags.map((t: { tagId: string }) => t.tagId).sort();
  const nextTags = tagIds.slice().sort();
  if (previousTags.join(",") !== nextTags.join(",")) changedFields.push("tags");

  const activityWrites = [];
  if (changedFields.length > 0) {
    activityWrites.push(
      prisma.taskActivity.create({
        data: {
          taskId,
          workspaceId,
          projectId,
          actorId: session.user.id,
          type: "edited",
          data: { changed: changedFields },
        },
      })
    );
  }
  if ((task.assigneeId ?? null) !== (assigneeId ?? null)) {
    activityWrites.push(
      prisma.taskActivity.create({
        data: {
          taskId,
          workspaceId,
          projectId,
          actorId: session.user.id,
          type: "assigned",
          data: { from: task.assigneeId ?? null, to: assigneeId ?? null },
        },
      })
    );
  }

  if (activityWrites.length > 0) {
    await prisma.$transaction(activityWrites);
  }

  if (assigneeId && assigneeId !== session.user.id && assigneeId !== task.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: assigneeId,
        workspaceId,
        taskId,
        type: "task_assigned",
        title: "You were assigned a task",
        body: title,
      },
    });
  }

  return NextResponse.json({ ok: true, task: updated });
}
