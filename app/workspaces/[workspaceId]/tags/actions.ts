"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createTag(workspaceId: string, formData: FormData) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect(`/workspaces/${workspaceId}/tags`);
  const nameLen = maxLen(nameResult.value, 40, "Name is too long");
  if (!nameLen.ok) redirect(`/workspaces/${workspaceId}/tags`);
  const color = String(formData.get("color") ?? "").trim();

  await prisma.tag.create({
    data: {
      workspaceId,
      name: nameResult.value,
      color: color || null,
    },
  });

  redirect(`/workspaces/${workspaceId}/tags`);
}

export async function deleteTag(workspaceId: string, tagId: string) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  await prisma.tag.delete({ where: { id: tagId } });
  redirect(`/workspaces/${workspaceId}/tags`);
}
