"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember, requireWorkspaceRole } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createProject(workspaceId: string, formData: FormData) {
  await requireWorkspaceMember(workspaceId);

  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect(`/workspaces/${workspaceId}/projects`);
  const name = nameResult.value;
  const description = String(formData.get("description") ?? "").trim();
  const nameLen = maxLen(name, 120, "Name is too long");
  if (!nameLen.ok) redirect(`/workspaces/${workspaceId}/projects`);

  await prisma.project.create({
    data: {
      workspaceId,
      name,
      description: description || null,
    },
  });

  redirect(`/workspaces/${workspaceId}/projects`);
}

export async function updateProjectSettings(
  workspaceId: string,
  projectId: string,
  formData: FormData
) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
  const name = nameResult.value;
  const description = String(formData.get("description") ?? "").trim();
  const nameLen = maxLen(name, 120, "Name is too long");
  if (!nameLen.ok) redirect(`/workspaces/${workspaceId}/projects/${projectId}/settings`);

  await prisma.project.update({
    where: { id: projectId, workspaceId },
    data: { name, description: description || null },
  });

  redirect(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
}

export async function toggleProjectArchive(workspaceId: string, projectId: string) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { archived: true },
  });
  if (!project) redirect(`/workspaces/${workspaceId}/projects`);

  await prisma.project.update({
    where: { id: projectId, workspaceId },
    data: { archived: !project.archived },
  });

  redirect(`/workspaces/${workspaceId}/projects`);
}

export async function deleteProject(workspaceId: string, projectId: string) {
  await requireWorkspaceRole(workspaceId, ["owner"]);

  await prisma.project.delete({
    where: { id: projectId, workspaceId },
  });

  redirect(`/workspaces/${workspaceId}/projects`);
}
