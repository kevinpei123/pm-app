"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/rbac";
import { maxLen } from "@/lib/validation";

export async function createTimeEntry(workspaceId: string, formData: FormData) {
  const { session } = await requireWorkspaceMember(workspaceId);
  const description = String(formData.get("description") ?? "").trim();
  const startAt = String(formData.get("startAt") ?? "");
  const endAt = String(formData.get("endAt") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");

  if (!startAt || !endAt) redirect(`/workspaces/${workspaceId}/time`);

  if (description) {
    const len = maxLen(description, 200, "Description too long");
    if (!len.ok) redirect(`/workspaces/${workspaceId}/time`);
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));

  await prisma.timeEntry.create({
    data: {
      workspaceId,
      userId: session.user.id,
      projectId: projectId || null,
      taskId: taskId || null,
      description: description || null,
      startAt: startDate,
      endAt: endDate,
      minutes,
    },
  });

  redirect(`/workspaces/${workspaceId}/time`);
}

export async function deleteTimeEntry(workspaceId: string, entryId: string) {
  const { session } = await requireWorkspaceMember(workspaceId);
  await prisma.timeEntry.delete({
    where: { id: entryId, workspaceId, userId: session.user.id },
  });
  redirect(`/workspaces/${workspaceId}/time`);
}
