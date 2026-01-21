import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";
import { parseDateInput, parsePriority } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  type TaskRef = { id: string; workspaceId: string; projectId: string };

  const body = await req.json();
  const taskIds: string[] = Array.isArray(body.taskIds)
    ? body.taskIds.map((id: unknown) => String(id)).filter(Boolean)
    : [];
  const updates = body.updates ?? {};

  if (taskIds.length === 0) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const tasks: TaskRef[] = await prisma.task.findMany({
    where: { id: { in: taskIds }, deletedAt: null },
    select: { id: true, workspaceId: true, projectId: true },
  });
  if (tasks.length !== taskIds.length) {
    return NextResponse.json({ error: "Invalid tasks" }, { status: 400 });
  }

  const workspaceIds = Array.from(new Set(tasks.map((t) => t.workspaceId)));
  for (const workspaceId of workspaceIds) {
    const member = await getWorkspaceMember(workspaceId, session.user.id);
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = updates.status as string | undefined;
  if (status && !["todo", "in_progress", "done"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const priorityResult = updates.priority !== undefined ? parsePriority(updates.priority, 0, 5) : null;
  if (priorityResult && !priorityResult.ok) {
    return NextResponse.json({ error: priorityResult.error }, { status: 400 });
  }

  const dueDateResult = updates.dueDate !== undefined ? parseDateInput(updates.dueDate) : null;
  if (dueDateResult && !dueDateResult.ok) {
    return NextResponse.json({ error: dueDateResult.error }, { status: 400 });
  }

  const startDateResult = updates.startDate !== undefined ? parseDateInput(updates.startDate) : null;
  if (startDateResult && !startDateResult.ok) {
    return NextResponse.json({ error: startDateResult.error }, { status: 400 });
  }

  const assigneeId = updates.assigneeId === null ? null : String(updates.assigneeId ?? "");
  if (assigneeId) {
    for (const workspaceId of workspaceIds) {
      const assigneeMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
      });
      if (!assigneeMember) {
        return NextResponse.json({ error: "Assignee not in workspace" }, { status: 400 });
      }
    }
  }

  const updateData = {
    status,
    assigneeId: assigneeId === undefined ? undefined : assigneeId,
    priority: priorityResult?.ok ? priorityResult.value : undefined,
    dueDate: dueDateResult?.ok ? dueDateResult.value : undefined,
    startDate: startDateResult?.ok ? startDateResult.value : undefined,
    durationMinutes: updates.durationMinutes === undefined ? undefined : Number(updates.durationMinutes),
    blocked: updates.blocked === undefined ? undefined : Boolean(updates.blocked),
    inbox: updates.inbox === undefined ? undefined : Boolean(updates.inbox),
    archivedAt: updates.archivedAt ? new Date(String(updates.archivedAt)) : undefined,
    type: updates.type ? String(updates.type) : undefined,
    recurrenceRule: updates.recurrenceRule === undefined ? undefined : String(updates.recurrenceRule || ""),
    recurrenceTimezone:
      updates.recurrenceTimezone === undefined ? undefined : String(updates.recurrenceTimezone || ""),
    recurrenceExceptions:
      updates.recurrenceExceptions === undefined ? undefined : updates.recurrenceExceptions,
    recurrenceEndAt: updates.recurrenceEndAt ? new Date(String(updates.recurrenceEndAt)) : undefined,
  };

  await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: updateData,
  });

  const activityWrites = tasks.map((task) =>
    prisma.taskActivity.create({
      data: {
        taskId: task.id,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: session.user.id,
        type: "bulk_edited",
        data: { updates },
      },
    })
  );

  await prisma.$transaction(activityWrites);

  return NextResponse.json({ ok: true });
}
