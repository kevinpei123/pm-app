import { redirect } from "next/navigation";

export default async function AutomationsRedirect({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/workspaces/${workspaceId}/settings`);
}
