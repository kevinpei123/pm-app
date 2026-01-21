"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createGoal(workspaceId: string, projectId: string, formData: FormData) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  const titleResult = requireTrimmed(formData.get("title"), "Title is required");
  if (!titleResult.ok) redirect(`/workspaces/${workspaceId}/projects/${projectId}/goals`);
  const titleLen = maxLen(titleResult.value, 120, "Title is too long");
  if (!titleLen.ok) redirect(`/workspaces/${workspaceId}/projects/${projectId}/goals`);
  const description = String(formData.get("description") ?? "").trim();

  await prisma.goal.create({
    data: {
      projectId,
      title: titleResult.value,
      description: description || null,
    },
  });

  redirect(`/workspaces/${workspaceId}/projects/${projectId}/goals`);
}

export async function createMilestone(workspaceId: string, projectId: string, formData: FormData) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  const titleResult = requireTrimmed(formData.get("title"), "Title is required");
  if (!titleResult.ok) redirect(`/workspaces/${workspaceId}/projects/${projectId}/milestones`);
  const titleLen = maxLen(titleResult.value, 120, "Title is too long");
  if (!titleLen.ok) redirect(`/workspaces/${workspaceId}/projects/${projectId}/milestones`);
  const description = String(formData.get("description") ?? "").trim();
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();

  await prisma.milestone.create({
    data: {
      projectId,
      title: titleResult.value,
      description: description || null,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
    },
  });

  redirect(`/workspaces/${workspaceId}/projects/${projectId}/milestones`);
}

export async function addProjectMember(
  workspaceId: string,
  projectId: string,
  formData: FormData
) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  const userId = String(formData.get("userId") ?? "");
  if (!userId) redirect(`/workspaces/${workspaceId}/projects/${projectId}/members`);

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId },
  });

  redirect(`/workspaces/${workspaceId}/projects/${projectId}/members`);
}

export async function removeProjectMember(
  workspaceId: string,
  projectId: string,
  userId: string
) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
  redirect(`/workspaces/${workspaceId}/projects/${projectId}/members`);
}
