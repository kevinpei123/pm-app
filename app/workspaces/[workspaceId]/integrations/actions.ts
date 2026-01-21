"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

const PROVIDERS = ["google", "microsoft", "slack"] as const;

export async function addIntegration(workspaceId: string, formData: FormData) {
  await requireWorkspaceMember(workspaceId);
  const nameResult = requireTrimmed(formData.get("provider"), "Provider is required");
  if (!nameResult.ok) redirect(`/workspaces/${workspaceId}/integrations`);
  const provider = PROVIDERS.includes(nameResult.value.toLowerCase() as typeof PROVIDERS[number])
    ? nameResult.value.toLowerCase()
    : "custom";
  const labelLen = maxLen(provider, 40, "Provider name too long");
  if (!labelLen.ok) redirect(`/workspaces/${workspaceId}/integrations`);

  await prisma.integration.create({
    data: {
      workspaceId,
      provider,
      status: "pending",
    },
  });

  redirect(`/workspaces/${workspaceId}/integrations`);
}

export async function setIntegrationStatus(
  workspaceId: string,
  integrationId: string,
  status: string
) {
  await requireWorkspaceMember(workspaceId);
  const nextStatus = ["pending", "active", "inactive"].includes(status) ? status : "inactive";
  await prisma.integration.updateMany({
    where: { id: integrationId, workspaceId },
    data: { status: nextStatus },
  });
  redirect(`/workspaces/${workspaceId}/integrations`);
}

export async function deleteIntegration(workspaceId: string, integrationId: string) {
  await requireWorkspaceMember(workspaceId);
  await prisma.integration.deleteMany({ where: { id: integrationId, workspaceId } });
  redirect(`/workspaces/${workspaceId}/integrations`);
}
