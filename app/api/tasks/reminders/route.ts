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
  const remindAtRaw = String(body.remindAt ?? "");

  if (!workspaceId || !taskId || !remindAtRaw) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const member = await getWorkspaceMember(workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const remindAt = new Date(remindAtRaw);
  if (Number.isNaN(remindAt.getTime())) {
    return NextResponse.json({ error: "Invalid reminder date" }, { status: 400 });
  }

  const reminder = await prisma.taskReminder.create({
    data: {
      taskId,
      userId: session.user.id,
      remindAt,
    },
  });

  return NextResponse.json({ ok: true, reminder });
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = String(searchParams.get("workspaceId") ?? "");
  const taskId = String(searchParams.get("taskId") ?? "");

  if (!workspaceId || !taskId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const member = await getWorkspaceMember(workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reminders = await prisma.taskReminder.findMany({
    where: { taskId, userId: session.user.id },
    orderBy: { remindAt: "asc" },
  });

  return NextResponse.json({ reminders });
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const reminderId = String(body.reminderId ?? "");
  const snoozeMinutes = body.snoozeMinutes ? Number(body.snoozeMinutes) : null;
  const complete = Boolean(body.complete);

  if (!reminderId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const reminder = await prisma.taskReminder.findFirst({
    where: { id: reminderId, userId: session.user.id },
    select: { id: true, remindAt: true },
  });
  if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { snoozedUntil?: Date | null; completedAt?: Date | null } = {};
  if (snoozeMinutes) {
    const next = new Date(reminder.remindAt);
    next.setMinutes(next.getMinutes() + snoozeMinutes);
    data.snoozedUntil = next;
  }
  if (complete) {
    data.completedAt = new Date();
  }

  const updated = await prisma.taskReminder.update({
    where: { id: reminderId },
    data,
  });

  return NextResponse.json({ ok: true, reminder: updated });
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const reminderId = String(searchParams.get("id") ?? "");
  if (!reminderId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  await prisma.taskReminder.deleteMany({ where: { id: reminderId, userId: session.user.id } });

  return NextResponse.json({ ok: true });
}
