"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createEvent(workspaceId: string, formData: FormData) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  const titleResult = requireTrimmed(formData.get("title"), "Title is required");
  if (!titleResult.ok) redirect(`/workspaces/${workspaceId}/calendar`);
  const titleLen = maxLen(titleResult.value, 120, "Title is too long");
  if (!titleLen.ok) redirect(`/workspaces/${workspaceId}/calendar`);

  const startAt = String(formData.get("startAt") ?? "");
  const endAt = String(formData.get("endAt") ?? "");
  if (!startAt || !endAt) redirect(`/workspaces/${workspaceId}/calendar`);

  await prisma.calendarEvent.create({
    data: {
      workspaceId,
      title: titleResult.value,
      description: String(formData.get("description") ?? "").trim() || null,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      allDay: Boolean(formData.get("allDay")),
    },
  });

  redirect(`/workspaces/${workspaceId}/calendar`);
}
