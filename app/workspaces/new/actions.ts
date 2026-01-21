"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maxLen, requireTrimmed } from "@/lib/validation";

export async function createWorkspace(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const nameResult = requireTrimmed(formData.get("name"), "Name is required");
  if (!nameResult.ok) redirect("/workspaces/new");
  const name = nameResult.value;
  const lenResult = maxLen(name, 80, "Name is too long");
  if (!lenResult.ok) redirect("/workspaces/new");

  const workspace = await prisma.workspace.create({
    data: {
      name,
      members: {
        create: {
          userId: session.user.id,
          role: "owner",
        },
      },
    },
  });

  redirect(`/workspaces/${workspace.id}`);
}
