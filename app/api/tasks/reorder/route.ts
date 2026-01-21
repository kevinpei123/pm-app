import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember } from "@/lib/rbac";

type Status = "todo" | "in_progress" | "done";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const workspaceId = String(body.workspaceId ?? "");
    const projectId = String(body.projectId ?? "");
    const columns = body.columns as Record<Status, string[]> | undefined;

    if (!workspaceId || !projectId || !columns) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    // membership check
    const membership = await getWorkspaceMember(workspaceId, session.user.id);
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // project must belong to workspace
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const allIds = [
      ...(columns.todo ?? []),
      ...(columns.in_progress ?? []),
      ...(columns.done ?? []),
    ];

    // Validate all task IDs belong to this project+workspace
    const found = await prisma.task.findMany({
      where: { id: { in: allIds }, workspaceId, projectId },
      select: { id: true },
    });
    if (found.length !== allIds.length) {
      return NextResponse.json({ error: "Invalid task list" }, { status: 400 });
    }

    type ExistingTask = { id: string; status: string; order: number };

    const existing: ExistingTask[] = await prisma.task.findMany({
      where: { id: { in: allIds }, workspaceId, projectId },
      select: { id: true, status: true, order: true },
    });
    const existingById = new Map(existing.map((task) => [task.id, task]));

    // Write orders with gaps (1000) so future inserts have room
    const updates: Array<{ id: string; status: Status; order: number }> = [];

    const pushUpdates = (status: Status, ids: string[]) => {
      ids.forEach((id, idx) => updates.push({ id, status, order: (idx + 1) * 1000 }));
    };

    pushUpdates("todo", columns.todo ?? []);
    pushUpdates("in_progress", columns.in_progress ?? []);
    pushUpdates("done", columns.done ?? []);

    const activityData = updates
      .map((u) => {
        const prev = existingById.get(u.id);
        if (!prev) return null;
        if (prev.status === u.status && prev.order === u.order) return null;
        return {
          taskId: u.id,
          workspaceId,
          projectId,
          actorId: session.user.id,
          type: "moved",
          data: { fromStatus: prev.status, toStatus: u.status, fromOrder: prev.order, toOrder: u.order },
        };
      })
      .filter(Boolean) as Array<{
      taskId: string;
      workspaceId: string;
      projectId: string;
      actorId: string;
      type: string;
      data: { fromStatus: string; toStatus: string; fromOrder: number; toOrder: number };
    }>;

    await prisma.$transaction([
      ...updates.map((u) =>
        prisma.task.update({
          where: { id: u.id },
          data: { status: u.status, order: u.order },
        })
      ),
      ...(activityData.length > 0
        ? [
            prisma.taskActivity.createMany({
              data: activityData,
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
