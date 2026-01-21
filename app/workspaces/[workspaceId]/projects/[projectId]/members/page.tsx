import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addProjectMember, removeProjectMember } from "../meta-actions";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
  if (!project) redirect(`/workspaces/${workspaceId}/projects`);

  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Project members</h1>
          <p className="text-sm text-zinc-500">{project.name}</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}/projects/${projectId}`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to project
        </Link>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await addProjectMember(workspaceId, projectId, formData);
        }}
        className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <select
          name="userId"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
        >
          <option value="">Select member</option>
          {workspaceMembers.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name} ({m.user.email})
            </option>
          ))}
        </select>
        <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Add to project
        </button>
      </form>

      <div className="grid gap-2">
        {projectMembers.length === 0 ? (
          <p className="text-sm text-zinc-500">No members yet.</p>
        ) : (
          projectMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3"
            >
              <div>
                <div className="text-sm font-medium">{member.user.name}</div>
                <div className="text-xs text-zinc-500">{member.user.email}</div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await removeProjectMember(workspaceId, projectId, member.userId);
                }}
              >
                <button className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50">
                  Remove
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
