import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PomodoroWidget from "@/components/pomodoro-widget";

export const metadata: Metadata = {
  title: "pm-app",
  description: "Project management app",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const unreadCount = session
    ? await prisma.notification.count({
        where: { userId: session.user.id, readAt: null },
      })
    : 0;

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        {session ? (
          <header className="border-b border-zinc-200 bg-white">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/workspaces" className="text-lg font-semibold">
                pm-app
              </Link>
              <div className="flex items-center gap-4">
                <Link href="/notifications" className="flex items-center gap-2 text-sm">
                  <span>Notifications</span>
                  {unreadCount > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {unreadCount}
                    </span>
                  ) : null}
                </Link>
                <div className="rounded-full border border-zinc-200 px-3 py-1 text-sm">
                  {session.user.name}
                </div>
              </div>
            </div>
          </header>
        ) : null}
        {children}
        <PomodoroWidget />
      </body>
    </html>
  );
}
