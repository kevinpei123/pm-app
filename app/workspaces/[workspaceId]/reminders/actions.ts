"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createReminder(workspaceId: string, formData: FormData) {
  const { session } = await requireWorkspaceMember(workspaceId);
  const titleResult = requireTrimmed(formData.get("title"), "Title is required");
  if (!titleResult.ok) redirect(`/workspaces/${workspaceId}/reminders`);
  const titleLen = maxLen(titleResult.value, 120, "Title is too long");
  if (!titleLen.ok) redirect(`/workspaces/${workspaceId}/reminders`);

  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();

  await prisma.reminder.create({
    data: {
      workspaceId,
      userId: session.user.id,
      title: titleResult.value,
      dueAt: dueAtRaw ? new Date(dueAtRaw) : null,
    },
  });

  redirect(`/workspaces/${workspaceId}/reminders`);
}

export async function toggleReminder(workspaceId: string, reminderId: string) {
  const { session } = await requireWorkspaceMember(workspaceId);
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, workspaceId, userId: session.user.id },
  });
  if (!reminder) redirect(`/workspaces/${workspaceId}/reminders`);

  await prisma.reminder.update({
    where: { id: reminderId },
    data: { completedAt: reminder.completedAt ? null : new Date() },
  });

  redirect(`/workspaces/${workspaceId}/reminders`);
}

export async function deleteReminder(workspaceId: string, reminderId: string) {
  const { session } = await requireWorkspaceMember(workspaceId);
  await prisma.reminder.delete({
    where: { id: reminderId, workspaceId, userId: session.user.id },
  });
  redirect(`/workspaces/${workspaceId}/reminders`);
}
