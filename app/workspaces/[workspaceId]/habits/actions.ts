"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createHabit(workspaceId: string, formData: FormData) {
  const { session } = await requireWorkspaceMember(workspaceId);
  const titleResult = requireTrimmed(formData.get("title"), "Title is required");
  if (!titleResult.ok) redirect(`/workspaces/${workspaceId}/habits`);
  const titleLen = maxLen(titleResult.value, 120, "Title is too long");
  if (!titleLen.ok) redirect(`/workspaces/${workspaceId}/habits`);
  const cadence = String(formData.get("cadence") ?? "daily");
  const target = Number(formData.get("targetPerWeek") ?? 5);

  await prisma.habit.create({
    data: {
      workspaceId,
      userId: session.user.id,
      title: titleResult.value,
      cadence: cadence === "weekly" ? "weekly" : cadence === "custom" ? "custom" : "daily",
      targetPerWeek: Number.isFinite(target) ? target : 5,
    },
  });

  redirect(`/workspaces/${workspaceId}/habits`);
}

export async function completeHabit(workspaceId: string, habitId: string) {
  const { session } = await requireWorkspaceMember(workspaceId);
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, workspaceId, userId: session.user.id },
  });
  if (!habit) redirect(`/workspaces/${workspaceId}/habits`);

  await prisma.$transaction([
    prisma.habitLog.create({
      data: {
        habitId,
        workspaceId,
        userId: session.user.id,
      },
    }),
    prisma.habit.update({
      where: { id: habitId },
      data: {
        streak: habit.streak + 1,
        lastCompletedAt: new Date(),
      },
    }),
  ]);

  redirect(`/workspaces/${workspaceId}/habits`);
}

export async function deleteHabit(workspaceId: string, habitId: string) {
  const { session } = await requireWorkspaceMember(workspaceId);
  await prisma.habit.delete({
    where: { id: habitId, workspaceId, userId: session.user.id },
  });
  redirect(`/workspaces/${workspaceId}/habits`);
}
