"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/rbac";
import { maxLen, requireTrimmed } from "@/lib/validation";
import { parseQuickAdd } from "@/lib/nlp";

export async function createQuickTask(formData: FormData) {
  const session = await requireSession();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const inputResult = requireTrimmed(formData.get("input"), "Task is required");
  if (!inputResult.ok) redirect("/workspaces");

  const input = inputResult.value;
  const inputLen = maxLen(input, 240, "Task input is too long");
  if (!inputLen.ok) redirect("/workspaces");

  if (!workspaceId || !projectId) redirect("/workspaces");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  const parsed = parseQuickAdd(input);
  if (!parsed.title) redirect("/workspaces");

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const assigneeToken = parsed.assigneeTokens[0]?.toLowerCase();
  const assignee = assigneeToken
    ? members.find((m) =>
        [m.user.name, m.user.email].filter(Boolean).some((value) =>
          String(value).toLowerCase().includes(assigneeToken)
        )
      )
    : null;

  const tags = parsed.tagNames.length
    ? await Promise.all(
        parsed.tagNames.map(async (name) =>
          prisma.tag.upsert({
            where: { workspaceId_name: { workspaceId, name } },
            update: {},
            create: { workspaceId, name },
          })
        )
      )
    : [];

  const task = await prisma.task.create({
    data: {
      workspaceId,
      projectId,
      title: parsed.title,
      description: null,
      status: "todo",
      priority: 0,
      assigneeId: assignee?.user.id ?? session.user.id,
      createdById: session.user.id,
      dueDate: parsed.dueDate,
      durationMinutes: parsed.durationMinutes,
      inbox: true,
      recurrenceRule: parsed.recurrenceRule,
      recurrenceTimezone: "UTC",
      tags: tags.length
        ? { createMany: { data: tags.map((tag) => ({ tagId: tag.id, workspaceId })) } }
        : undefined,
    },
    select: { id: true },
  });

  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      workspaceId,
      projectId,
      actorId: session.user.id,
      type: "created",
      data: { source: "quick_add" },
    },
  });

  if (assignee?.user.id && assignee.user.id !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: assignee.user.id,
        workspaceId,
        taskId: task.id,
        type: "task_assigned",
        title: "You were assigned a task",
        body: parsed.title,
      },
    });
  }

  redirect("/workspaces");
}

export async function saveTaskFilter(formData: FormData) {
  const session = await requireSession();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect("/workspaces");
  const filtersRaw = String(formData.get("filters") ?? "");

  if (!workspaceId || !filtersRaw) redirect("/workspaces");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  let filters: Prisma.InputJsonValue;
  try {
    filters = JSON.parse(filtersRaw) as Prisma.InputJsonValue;
  } catch {
    redirect("/workspaces");
    return;
  }

  await prisma.savedTaskFilter.create({
    data: {
      workspaceId,
      userId: session.user.id,
      name: nameResult.value,
      filters,
    },
  });

  redirect("/workspaces");
}

export async function deleteTaskFilter(workspaceId: string, filterId: string) {
  const session = await requireSession();
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  await prisma.savedTaskFilter.deleteMany({
    where: { id: filterId, workspaceId, userId: session.user.id },
  });

  redirect("/workspaces");
}
