"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

async function requireMember(workspaceId: string) {
  const { session } = await requireWorkspaceMember(workspaceId);
  return session;
}

export async function createTask(workspaceId: string, projectId: string, status: string, formData: FormData) {
  const session = await requireMember(workspaceId);

  const titleResult = requireTrimmed(formData.get("title"), "Title is required");
  if (!titleResult.ok) redirect(`/workspaces/${workspaceId}/projects/${projectId}`);
  const title = titleResult.value;
  const titleLen = maxLen(title, 120, "Title is too long");
  if (!titleLen.ok) redirect(`/workspaces/${workspaceId}/projects/${projectId}`);

  const description = String(formData.get("description") ?? "").trim();

  const task = await prisma.task.create({
    data: {
      workspaceId,
      projectId,
      title,
      description: description || null,
      status, // "todo" | "in_progress" | "done"
      createdById: session.user.id,
      inbox: false,
    },
    select: { id: true },
  });

  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      workspaceId,
      projectId,
      actorId: session.user.id,
      type: "created",
      data: { status },
    },
  });

  redirect(`/workspaces/${workspaceId}/projects/${projectId}`);
}

export async function moveTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
  newStatus: string
) {
  await requireMember(workspaceId);

  await prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus },
  });

  redirect(`/workspaces/${workspaceId}/projects/${projectId}`);
}
