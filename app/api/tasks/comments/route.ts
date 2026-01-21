import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

const MAX_COMMENT = 1000;

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

  const membership = await getWorkspaceMember(workspaceId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comments = await prisma.taskComment.findMany({
    where: { taskId, workspaceId, projectId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ comments });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = String(body.workspaceId ?? "");
  const projectId = String(body.projectId ?? "");
  const taskId = String(body.taskId ?? "");
  const textResult = requireTrimmed(body.body, "Comment is required");
  if (!textResult.ok) {
    return NextResponse.json({ error: textResult.error }, { status: 400 });
  }
  const text = textResult.value;

  if (!workspaceId || !projectId || !taskId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const lenResult = maxLen(text, MAX_COMMENT, `Comment must be ${MAX_COMMENT} characters or fewer`);
  if (!lenResult.ok) {
    return NextResponse.json({ error: lenResult.error }, { status: 400 });
  }

  const membership = await getWorkspaceMember(workspaceId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      workspaceId,
      projectId,
      authorId: session.user.id,
      body: text,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ ok: true, comment });
}
