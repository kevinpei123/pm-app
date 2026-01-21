"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createMessage(workspaceId: string, formData: FormData) {
  const { session } = await requireWorkspaceMember(workspaceId);
  const bodyResult = requireTrimmed(formData.get("body"), "Message is required");
  if (!bodyResult.ok) redirect(`/workspaces/${workspaceId}/messages`);
  const bodyLen = maxLen(bodyResult.value, 2000, "Message is too long");
  if (!bodyLen.ok) redirect(`/workspaces/${workspaceId}/messages`);

  await prisma.workspaceMessage.create({
    data: {
      workspaceId,
      authorId: session.user.id,
      body: bodyResult.value,
    },
  });

  redirect(`/workspaces/${workspaceId}/messages`);
}

export async function deleteMessage(workspaceId: string, messageId: string) {
  const { session, membership } = await requireWorkspaceMember(workspaceId);
  const message = await prisma.workspaceMessage.findFirst({
    where: { id: messageId, workspaceId },
  });
  if (!message) redirect(`/workspaces/${workspaceId}/messages`);

  const canDelete =
    message.authorId === session.user.id ||
    membership.role === "owner" ||
    membership.role === "admin";

  if (!canDelete) redirect(`/workspaces/${workspaceId}/messages`);

  await prisma.workspaceMessage.delete({ where: { id: messageId } });
  redirect(`/workspaces/${workspaceId}/messages`);
}
