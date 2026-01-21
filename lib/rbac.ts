import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Role = "owner" | "admin" | "member";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session;
}

export async function requireWorkspaceMember(workspaceId: string) {
  const session = await requireSession();
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");
  return { session, membership };
}

export async function requireWorkspaceRole(workspaceId: string, roles: Role[]) {
  const { session, membership } = await requireWorkspaceMember(workspaceId);
  if (!roles.includes(membership.role as Role)) {
    redirect(`/workspaces/${workspaceId}`);
  }
  return { session, membership };
}

export async function getSessionFromHeaders(reqHeaders: Headers) {
  return auth.api.getSession({ headers: reqHeaders });
}

export async function getWorkspaceMember(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export function hasRole(role: string, roles: Role[]) {
  return roles.includes(role as Role);
}
