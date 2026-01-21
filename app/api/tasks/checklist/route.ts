import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";

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

  const items = await prisma.taskChecklistItem.findMany({
    where: { taskId },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = String(body.workspaceId ?? "");
  const taskId = String(body.taskId ?? "");
  const title = String(body.title ?? "").trim();

  if (!workspaceId || !taskId || !title) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const member = await getWorkspaceMember(workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const count = await prisma.taskChecklistItem.count({ where: { taskId } });
  const item = await prisma.taskChecklistItem.create({
    data: {
      taskId,
      title,
      order: count,
    },
  });

  return NextResponse.json({ item });
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const itemId = String(body.itemId ?? "");
  const completed = Boolean(body.completed);

  if (!itemId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const item = await prisma.taskChecklistItem.findFirst({
    where: { id: itemId },
    include: { task: { select: { workspaceId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await getWorkspaceMember(item.task.workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: { completedAt: completed ? new Date() : null },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const itemId = String(searchParams.get("id") ?? "");
  if (!itemId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const item = await prisma.taskChecklistItem.findFirst({
    where: { id: itemId },
    include: { task: { select: { workspaceId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await getWorkspaceMember(item.task.workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.taskChecklistItem.delete({ where: { id: itemId } });

  return NextResponse.json({ ok: true });
}
