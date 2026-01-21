import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = String(body.workspaceId ?? "");
  const taskId = String(body.taskId ?? "");

  if (!workspaceId || !taskId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const member = await getWorkspaceMember(workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
    select: { id: true, projectId: true, archivedAt: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  if (!task.archivedAt) {
    await prisma.task.update({
      where: { id: taskId },
      data: { archivedAt: now },
    });
  } else {
    await prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: now },
    });
  }

  await prisma.taskActivity.create({
    data: {
      taskId,
      workspaceId,
      projectId: task.projectId,
      actorId: session.user.id,
      type: task.archivedAt ? "deleted" : "archived",
      data: {},
    },
  });

  return NextResponse.json({ ok: true });
}
