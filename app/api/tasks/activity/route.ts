import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";

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

  const activity = await prisma.taskActivity.findMany({
    where: { taskId, workspaceId, projectId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, name: true, email: true } } },
    take: 50,
  });

  return NextResponse.json({ activity });
}
