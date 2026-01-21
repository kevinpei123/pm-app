import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = String(body.workspaceId ?? "");
  const projectId = String(body.projectId ?? "");
  const taskId = String(body.taskId ?? "");
  const assigneeId = body.assigneeId === null ? null : String(body.assigneeId ?? "");

  if (!workspaceId || !projectId || !taskId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // current user must be in workspace
  const me = await getWorkspaceMember(workspaceId, session.user.id);
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // task must belong to this project+workspace
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, projectId },
    select: { id: true, assigneeId: true, title: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // if assigning, assignee must be in workspace too
  if (assigneeId) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
    });
    if (!member) return NextResponse.json({ error: "Assignee not in workspace" }, { status: 400 });
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId: assigneeId || null },
  });

  if ((task.assigneeId ?? null) !== (assigneeId ?? null)) {
    await prisma.taskActivity.create({
      data: {
        taskId,
        workspaceId,
        projectId,
        actorId: session.user.id,
        type: "assigned",
        data: { from: task.assigneeId ?? null, to: assigneeId ?? null },
      },
    });
  }

  if (assigneeId && assigneeId !== session.user.id && assigneeId !== task.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: assigneeId,
        workspaceId,
        taskId,
        type: "task_assigned",
        title: "You were assigned a task",
        body: task.title,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
