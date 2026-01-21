"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createAutomation(workspaceId: string, formData: FormData) {
  await requireWorkspaceMember(workspaceId);
  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect(`/workspaces/${workspaceId}/automations`);
  const nameLen = maxLen(nameResult.value, 120, "Name is too long");
  if (!nameLen.ok) redirect(`/workspaces/${workspaceId}/automations`);

  const trigger = String(formData.get("trigger") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  if (!trigger || !action) redirect(`/workspaces/${workspaceId}/automations`);

  const rawConfig = String(formData.get("config") ?? "").trim();
  let config: Prisma.InputJsonValue | null = null;
  if (rawConfig) {
    try {
      config = JSON.parse(rawConfig) as Prisma.InputJsonValue;
    } catch {
      redirect(`/workspaces/${workspaceId}/automations`);
    }
  }

  await prisma.automation.create({
    data: {
      workspaceId,
      name: nameResult.value,
      trigger,
      action,
      config: config ?? undefined,
    },
  });

  redirect(`/workspaces/${workspaceId}/automations`);
}

export async function toggleAutomation(workspaceId: string, automationId: string) {
  await requireWorkspaceMember(workspaceId);
  const automation = await prisma.automation.findFirst({
    where: { id: automationId, workspaceId },
  });
  if (!automation) redirect(`/workspaces/${workspaceId}/automations`);

  await prisma.automation.update({
    where: { id: automationId },
    data: { enabled: !automation.enabled },
  });

  redirect(`/workspaces/${workspaceId}/automations`);
}

export async function deleteAutomation(workspaceId: string, automationId: string) {
  await requireWorkspaceMember(workspaceId);
  await prisma.automation.deleteMany({ where: { id: automationId, workspaceId } });
  redirect(`/workspaces/${workspaceId}/automations`);
}
