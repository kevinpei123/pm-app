import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMessage, deleteMessage } from "../messages/actions";

export default async function UpdatesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  const messages = await prisma.workspaceMessage.findMany({
    where: { workspaceId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const activity = await prisma.taskActivity.findMany({
    where: { workspaceId },
    include: {
      actor: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, projectId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Updates</h1>
          <p className="text-sm text-zinc-500">Messages and recent activity in one place.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to workspace
        </Link>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Messages</h2>
          <p className="text-sm text-zinc-500">Share updates with the team.</p>
        </div>
        <form
          action={async (formData) => {
            "use server";
            await createMessage(workspaceId, formData);
          }}
          className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <textarea
            name="body"
            placeholder="Share an update..."
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            rows={3}
          />
          <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Post message
          </button>
        </form>

        <div className="grid gap-3">
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-500">No messages yet.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {message.author.name || "Unknown"}
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await deleteMessage(workspaceId, message.id);
                    }}
                  >
                    <button className="text-xs text-zinc-500 hover:text-zinc-700">Delete</button>
                  </form>
                </div>
                <div className="mt-2 text-sm text-zinc-700">{message.body}</div>
                <div className="mt-2 text-xs text-zinc-500">
                  {message.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Activity</h2>
          <p className="text-sm text-zinc-500">Latest task changes across projects.</p>
        </div>
        <div className="grid gap-2">
          {activity.length === 0 ? (
            <p className="text-sm text-zinc-500">No activity yet.</p>
          ) : (
            activity.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3"
              >
                <div>
                  <div className="text-sm font-medium">
                    {entry.actor.name || "Someone"} · {entry.type}
                  </div>
                  {entry.task ? (
                    <Link
                      className="text-xs text-zinc-500 hover:underline"
                      href={`/workspaces/${workspaceId}/projects/${entry.task.projectId}`}
                    >
                      {entry.task.title}
                    </Link>
                  ) : (
                    <div className="text-xs text-zinc-500">Task removed</div>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
