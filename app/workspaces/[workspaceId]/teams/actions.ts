"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createTeam(workspaceId: string, formData: FormData) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect(`/workspaces/${workspaceId}/teams`);
  const nameLen = maxLen(nameResult.value, 80, "Name is too long");
  if (!nameLen.ok) redirect(`/workspaces/${workspaceId}/teams`);

  await prisma.team.create({
    data: {
      workspaceId,
      name: nameResult.value,
    },
  });

  redirect(`/workspaces/${workspaceId}/teams`);
}

export async function addTeamMember(teamId: string, workspaceId: string, formData: FormData) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect(`/workspaces/${workspaceId}/teams/${teamId}`);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) redirect(`/workspaces/${workspaceId}/teams/${teamId}`);

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId: user.id } },
    update: {},
    create: { teamId, userId: user.id },
  });

  redirect(`/workspaces/${workspaceId}/teams/${teamId}`);
}

export async function removeTeamMember(teamId: string, workspaceId: string, userId: string) {
  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
  await prisma.teamMember.delete({
    where: { teamId_userId: { teamId, userId } },
  });
  redirect(`/workspaces/${workspaceId}/teams/${teamId}`);
}
