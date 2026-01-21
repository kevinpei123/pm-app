import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationsList from "./NotificationsList";

export default async function NotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  type NotificationRow = {
    id: string;
    type: string;
    title: string;
    body: string | null;
    readAt: Date | null;
    createdAt: Date;
  };

  const notifications: NotificationRow[] = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      readAt: true,
      createdAt: true,
    },
    take: 100,
  });
  const serializedNotifications = notifications.map((notification) => ({
    ...notification,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-zinc-500">Recent updates and mentions.</p>
      </div>
      <NotificationsList initialNotifications={serializedNotifications} />
    </div>
  );
}
