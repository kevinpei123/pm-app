"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsList({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [err, setErr] = useState<string | null>(null);

  const toggleRead = async (notificationId: string, read: boolean) => {
    setErr(null);
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, readAt: read ? new Date().toISOString() : null } : n
      )
    );

    const res = await fetch("/api/notifications/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId, read }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNotifications(previous);
      setErr(data.error ?? "Failed to update notification.");
    }
  };

  const markAllRead = async () => {
    setErr(null);
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    );

    const res = await fetch("/api/notifications/mark-all", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNotifications(previous);
      setErr(data.error ?? "Failed to mark all as read.");
    }
  };

  return (
    <div className="grid gap-3">
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {notifications.length > 0 ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={markAllRead}>
            Mark all read
          </Button>
        </div>
      ) : null}
      {notifications.length === 0 ? (
        <p className="text-sm text-zinc-500">No notifications yet.</p>
      ) : (
        notifications.map((n) => (
          <Card
            key={n.id}
            className={n.readAt ? "bg-white" : "bg-rose-50"}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">{n.title}</div>
                {n.body ? <div className="text-sm text-zinc-600">{n.body}</div> : null}
                <div className="text-xs text-zinc-500">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => toggleRead(n.id, !n.readAt)}>
                {n.readAt ? "Mark unread" : "Mark read"}
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
