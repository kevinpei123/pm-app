import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTag, deleteTag } from "./actions";

export default async function TagsPage({
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

  const tags = await prisma.tag.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  const canManage = membership.role === "owner" || membership.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tags</h1>
          <p className="text-sm text-zinc-500">Manage reusable task tags.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to workspace
        </Link>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await createTag(workspaceId, formData);
        }}
        className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <input
          name="name"
          placeholder="Tag name"
          disabled={!canManage}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
        />
        <input
          name="color"
          placeholder="#color (optional)"
          disabled={!canManage}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
        />
        <button
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          disabled={!canManage}
        >
          Add tag
        </button>
      </form>

      <div className="grid gap-2">
        {tags.length === 0 ? (
          <p className="text-sm text-zinc-500">No tags yet.</p>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3"
            >
              <span
                className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700"
                style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
              >
                {tag.name}
              </span>
              <form
                action={async () => {
                  "use server";
                  await deleteTag(workspaceId, tag.id);
                }}
              >
                <button
                  className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50"
                  disabled={!canManage}
                >
                  Delete
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
