import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addPageAttachment, updatePage } from "../actions";

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; pageId: string }>;
}) {
  const { workspaceId, pageId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) redirect("/workspaces");

  const page = await prisma.page.findFirst({
    where: { id: pageId, workspaceId },
    include: { attachments: true },
  });
  if (!page) redirect(`/workspaces/${workspaceId}/docs`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{page.title}</h1>
          <p className="text-sm text-zinc-500">Edit and manage attachments.</p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}/docs`}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Back to docs
        </Link>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await updatePage(workspaceId, pageId, formData);
        }}
        className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <input
          name="title"
          defaultValue={page.title}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <select
          name="format"
          defaultValue={page.format}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          <option value="markdown">Markdown</option>
          <option value="richtext">Rich text</option>
        </select>
        <textarea
          name="content"
          defaultValue={page.content}
          rows={12}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Save
        </button>
      </form>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Attachments</h2>
        <form
          action={async (formData) => {
            "use server";
            await addPageAttachment(workspaceId, pageId, formData);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            name="name"
            placeholder="Name"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-xs"
          />
          <input
            name="url"
            placeholder="https://..."
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm md:max-w-sm"
          />
          <button className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
            Add
          </button>
        </form>
        {page.attachments.length === 0 ? (
          <p className="text-sm text-zinc-500">No attachments yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {page.attachments.map((att) => (
              <li key={att.id}>
                <a href={att.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {att.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
