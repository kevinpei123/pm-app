import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

const MAX_NAME = 120;
const MAX_URL = 2000;

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const workspaceId = String(url.searchParams.get("workspaceId") ?? "");
  const projectId = String(url.searchParams.get("projectId") ?? "");
  const taskId = String(url.searchParams.get("taskId") ?? "");

  if (!workspaceId || !projectId || !taskId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const member = await getWorkspaceMember(workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, projectId },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ attachments });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = String(body.workspaceId ?? "");
  const projectId = String(body.projectId ?? "");
  const taskId = String(body.taskId ?? "");
  const nameResult = requireTrimmed(body.name, "Name is required");
  if (!nameResult.ok) return NextResponse.json({ error: nameResult.error }, { status: 400 });
  const urlValue = String(body.url ?? "").trim();

  if (!workspaceId || !projectId || !taskId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const nameLen = maxLen(nameResult.value, MAX_NAME, "Name is too long");
  if (!nameLen.ok) return NextResponse.json({ error: nameLen.error }, { status: 400 });
  const urlLen = maxLen(urlValue, MAX_URL, "URL is too long");
  if (!urlLen.ok) return NextResponse.json({ error: urlLen.error }, { status: 400 });

  const member = await getWorkspaceMember(workspaceId, session.user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, projectId },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId,
      name: nameResult.value,
      url: urlValue,
    },
  });

  return NextResponse.json({ ok: true, attachment });
}
