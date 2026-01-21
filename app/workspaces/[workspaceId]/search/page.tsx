import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { workspaceId } = await params;
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  const tasks = query
    ? await prisma.task.findMany({
        where: {
          workspaceId,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, title: true, projectId: true },
        take: 20,
      })
    : [];

  const comments = query
    ? await prisma.taskComment.findMany({
        where: {
          workspaceId,
          body: { contains: query, mode: "insensitive" },
        },
        include: { task: { select: { id: true, title: true, projectId: true } } },
        take: 20,
      })
    : [];

  const activity = query
    ? await prisma.taskActivity.findMany({
        where: {
          workspaceId,
          type: { contains: query, mode: "insensitive" },
        },
        include: { task: { select: { id: true, title: true, projectId: true } } },
        take: 20,
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Search</h1>
          <p className="text-sm text-zinc-500">Search across tasks, comments, and activity.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to workspace
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search keyword..."
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-md"
        />
        <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Search
        </button>
      </form>

      {query ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Tasks</h2>
            {tasks.length === 0 ? (
              <p className="text-sm text-zinc-500">No task matches.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/workspaces/${workspaceId}/projects/${task.projectId}`}
                      className="hover:underline"
                    >
                      {task.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Comments</h2>
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-500">No comment matches.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <Link
                      href={`/workspaces/${workspaceId}/projects/${comment.task.projectId}`}
                      className="hover:underline"
                    >
                      {comment.task.title}
                    </Link>
                    <span className="ml-2 text-zinc-500">— {comment.body.slice(0, 80)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity matches.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {activity.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/workspaces/${workspaceId}/projects/${item.task.projectId}`}
                      className="hover:underline"
                    >
                      {item.task.title}
                    </Link>
                    <span className="ml-2 text-zinc-500">— {item.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Enter a keyword to search.</p>
      )}
    </div>
  );
}
