"use server";
import { redirect } from "next/navigation";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/rbac";

export type InviteState = {
  ok: boolean;
  message: string | null;
};

export async function inviteMember(
  workspaceId: string,
  _prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "You must be signed in." };

  const me = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!me) return { ok: false, message: "You are not a member of this workspace." };

  if (me.role !== "owner" && me.role !== "admin") {
    return { ok: false, message: "Only owners/admins can invite members." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Email is required." };

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return {
      ok: false,
      message: "No user found with that email. Ask them to sign up first.",
    };
  }

  if (user.id === session.user.id) {
    return { ok: false, message: "You’re already in this workspace." };
  }

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });

  if (existing) {
    return { ok: true, message: `${user.email} is already a member.` };
  }

  await prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId: user.id,
      role: "member",
    },
  });

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      workspaceId,
      type: "workspace_invite",
      title: "You were added to a workspace",
      body: workspace?.name ?? "Workspace invite",
    },
  });

  return { ok: true, message: `Invited ${user.email} (added to workspace).` };
}


export async function updateMemberRole(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!workspaceId || !userId) redirect("/workspaces");

  // only allow these roles from UI
  if (role !== "admin" && role !== "member") {
    redirect(`/workspaces/${workspaceId}/members`);
  }

  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

  // don't allow editing owners
  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!target) redirect(`/workspaces/${workspaceId}/members`);
  if (target.role === "owner") redirect(`/workspaces/${workspaceId}/members`);

  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });

  redirect(`/workspaces/${workspaceId}/members`);
}

export async function removeMember(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const userId = String(formData.get("userId") ?? "");

  if (!workspaceId || !userId) redirect("/workspaces");

  await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

  // don't allow removing yourself
  if (userId === session.user.id) redirect(`/workspaces/${workspaceId}/members`);

  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!target) redirect(`/workspaces/${workspaceId}/members`);
  if (target.role === "owner") redirect(`/workspaces/${workspaceId}/members`);

  await prisma.$transaction([
    // unassign tasks for this user in this workspace
    prisma.task.updateMany({
      where: { workspaceId, assigneeId: userId },
      data: { assigneeId: null },
    }),
    prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    }),
  ]);

  redirect(`/workspaces/${workspaceId}/members`);
}
