"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember, requireWorkspaceRole } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function updateWorkspaceSettings(workspaceId: string, formData: FormData) {
  await requireWorkspaceRole(workspaceId, ["owner"]);
  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect(`/workspaces/${workspaceId}/settings`);
  const name = nameResult.value;
  const nameLen = maxLen(name, 80, "Name is too long");
  if (!nameLen.ok) redirect(`/workspaces/${workspaceId}/settings`);

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name },
  });

  redirect(`/workspaces/${workspaceId}/settings`);
}

export async function deleteWorkspace(workspaceId: string) {
  await requireWorkspaceRole(workspaceId, ["owner"]);

  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

  redirect("/workspaces");
}

export async function leaveWorkspace(workspaceId: string) {
  const { session, membership } = await requireWorkspaceMember(workspaceId);
  if (membership.role === "owner") redirect(`/workspaces/${workspaceId}/settings`);

  await prisma.$transaction([
    prisma.task.updateMany({
      where: { workspaceId, assigneeId: session.user.id },
      data: { assigneeId: null },
    }),
    prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    }),
  ]);

  redirect("/workspaces");
}

export async function transferWorkspaceOwnership(workspaceId: string, formData: FormData) {
  const { session } = await requireWorkspaceRole(workspaceId, ["owner"]);
  const newOwnerId = String(formData.get("newOwnerId") ?? "");
  if (!newOwnerId) redirect(`/workspaces/${workspaceId}/settings`);

  if (newOwnerId === session.user.id) redirect(`/workspaces/${workspaceId}/settings`);

  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
  });
  if (!target) redirect(`/workspaces/${workspaceId}/settings`);
  if (target.role === "owner") redirect(`/workspaces/${workspaceId}/settings`);

  await prisma.$transaction([
    prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
      data: { role: "admin" },
    }),
    prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
      data: { role: "owner" },
    }),
  ]);

  redirect(`/workspaces/${workspaceId}/settings`);
}
