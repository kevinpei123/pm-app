import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPage } from "./actions";

export default async function DocsPage({
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

  const pages = await prisma.page.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Docs</h1>
          <p className="text-sm text-zinc-500">Notes, docs, and pages.</p>
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
          await createPage(workspaceId, formData);
        }}
        className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <input
          name="title"
          placeholder="New page title"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-sm"
        />
        <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Create page
        </button>
      </form>

      <div className="grid gap-2">
        {pages.length === 0 ? (
          <p className="text-sm text-zinc-500">No pages yet.</p>
        ) : (
          pages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3"
            >
              <Link
                href={`/workspaces/${workspaceId}/docs/${page.id}`}
                className="text-sm font-medium hover:underline"
              >
                {page.title}
              </Link>
              <span className="text-xs text-zinc-500">{page.format}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
