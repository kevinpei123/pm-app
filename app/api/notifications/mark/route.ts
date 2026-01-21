import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const notificationId = String(body.notificationId ?? "");
  const read = Boolean(body.read);

  if (!notificationId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: session.user.id },
    select: { id: true },
  });
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: read ? new Date() : null },
    select: { id: true, readAt: true },
  });

  return NextResponse.json({ ok: true, notification: updated });
}
