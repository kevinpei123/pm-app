"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createPage(workspaceId: string, formData: FormData) {
  const { session } = await requireWorkspaceMember(workspaceId);
  const titleResult = requireTrimmed(formData.get("title"), "Title is required");
  if (!titleResult.ok) redirect(`/workspaces/${workspaceId}/docs`);
  const titleLen = maxLen(titleResult.value, 120, "Title is too long");
  if (!titleLen.ok) redirect(`/workspaces/${workspaceId}/docs`);

  await prisma.page.create({
    data: {
      workspaceId,
      authorId: session.user.id,
      title: titleResult.value,
      content: "",
      format: "markdown",
    },
  });

  redirect(`/workspaces/${workspaceId}/docs`);
}

export async function updatePage(workspaceId: string, pageId: string, formData: FormData) {
  await requireWorkspaceMember(workspaceId);
  const titleResult = requireTrimmed(formData.get("title"), "Title is required");
  if (!titleResult.ok) redirect(`/workspaces/${workspaceId}/docs/${pageId}`);
  const titleLen = maxLen(titleResult.value, 120, "Title is too long");
  if (!titleLen.ok) redirect(`/workspaces/${workspaceId}/docs/${pageId}`);
  const content = String(formData.get("content") ?? "");
  const format = String(formData.get("format") ?? "markdown");

  await prisma.page.update({
    where: { id: pageId, workspaceId },
    data: {
      title: titleResult.value,
      content,
      format: format === "richtext" ? "richtext" : "markdown",
    },
  });

  redirect(`/workspaces/${workspaceId}/docs/${pageId}`);
}

export async function addPageAttachment(
  workspaceId: string,
  pageId: string,
  formData: FormData
) {
  await requireWorkspaceMember(workspaceId);
  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect(`/workspaces/${workspaceId}/docs/${pageId}`);
  const url = String(formData.get("url") ?? "").trim();
  if (!url) redirect(`/workspaces/${workspaceId}/docs/${pageId}`);

  await prisma.pageAttachment.create({
    data: {
      pageId,
      name: nameResult.value,
      url,
    },
  });

  redirect(`/workspaces/${workspaceId}/docs/${pageId}`);
}
