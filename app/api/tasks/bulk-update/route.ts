import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";
import { parseDateInput, parseDateTimeInput, parsePriority } from "@/lib/validation";

type Status = "todo" | "in_progress" | "done";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = String(body.workspaceId ?? "");
  const projectId = String(body.projectId ?? "");
  const taskIds: string[] = Array.isArray(body.taskIds)
    ? body.taskIds.map((id: unknown) => String(id)).filter(Boolean)
    : [];
  const updates = body.updates ?? {};

  if (!workspaceId || !projectId || taskIds.length === 0) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const member = await getWorkspaceMember(workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = updates.status as Status | undefined;
  if (status && status !== "todo" && status !== "in_progress" && status !== "done") {
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

  const startDateResult = updates.startDate !== undefined ? parseDateTimeInput(updates.startDate) : null;
  if (startDateResult && !startDateResult.ok) {
    return NextResponse.json({ error: startDateResult.error }, { status: 400 });
  }

  const assigneeId = updates.assigneeId === null ? null : String(updates.assigneeId ?? "");
  if (assigneeId) {
    const assigneeMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
    });
    if (!assigneeMember) {
      return NextResponse.json({ error: "Assignee not in workspace" }, { status: 400 });
    }
  }

  const validTasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, workspaceId, projectId },
    select: { id: true },
  });
  if (validTasks.length !== taskIds.length) {
    return NextResponse.json({ error: "Invalid tasks" }, { status: 400 });
  }

  await prisma.task.updateMany({
    where: { id: { in: taskIds }, workspaceId, projectId },
    data: {
      status,
      assigneeId: assigneeId === undefined ? undefined : assigneeId,
      priority: priorityResult?.ok ? priorityResult.value : undefined,
      dueDate: dueDateResult?.ok ? dueDateResult.value : undefined,
      startDate: startDateResult?.ok ? startDateResult.value : undefined,
      durationMinutes: updates.durationMinutes === undefined ? undefined : Number(updates.durationMinutes),
      type: updates.type ? String(updates.type) : undefined,
      inbox: updates.inbox === undefined ? undefined : Boolean(updates.inbox),
      archivedAt: updates.archivedAt ? new Date(String(updates.archivedAt)) : undefined,
      recurrenceEndAt: updates.recurrenceEndAt ? new Date(String(updates.recurrenceEndAt)) : undefined,
      blocked: updates.blocked === undefined ? undefined : Boolean(updates.blocked),
    },
  });

  return NextResponse.json({ ok: true });
}
