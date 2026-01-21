"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createTemplate(workspaceId: string, formData: FormData) {
  const { session } = await requireWorkspaceMember(workspaceId);
  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect(`/workspaces/${workspaceId}/templates`);
  const nameLen = maxLen(nameResult.value, 120, "Name is too long");
  if (!nameLen.ok) redirect(`/workspaces/${workspaceId}/templates`);

  const typeRaw = String(formData.get("type") ?? "task");
  const type = ["task", "project", "page"].includes(typeRaw) ? typeRaw : "task";

  const description = String(formData.get("description") ?? "").trim() || null;
  const rawData = String(formData.get("data") ?? "").trim();
  let data: Prisma.InputJsonValue | null = null;
  if (rawData) {
    try {
      data = JSON.parse(rawData) as Prisma.InputJsonValue;
    } catch {
      redirect(`/workspaces/${workspaceId}/templates`);
    }
  }

  await prisma.template.create({
    data: {
      workspaceId,
      createdById: session.user.id,
      name: nameResult.value,
      type,
      description,
      data: data ?? undefined,
    },
  });

  redirect(`/workspaces/${workspaceId}/templates`);
}

export async function deleteTemplate(workspaceId: string, templateId: string) {
  await requireWorkspaceMember(workspaceId);
  await prisma.template.deleteMany({ where: { id: templateId, workspaceId } });
  redirect(`/workspaces/${workspaceId}/templates`);
}
