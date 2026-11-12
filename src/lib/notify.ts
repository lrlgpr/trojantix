import "server-only";
import { db } from "./db";

type Tx = Pick<typeof db, "notification" | "activityLog">;

/** In-app alert. In production this would also send an email to the @usc.edu address. */
export async function notify(
  userId: string,
  kind: string,
  title: string,
  body: string,
  tx: Tx = db,
) {
  await tx.notification.create({ data: { userId, kind, title, body } });
  console.log(`[alert -> ${userId}] ${title}: ${body}`);
}

export async function logActivity(
  entry: {
    userId?: string | null;
    email?: string | null;
    action: string;
    detail?: string;
    ip?: string;
    userAgent?: string;
    suspicious?: boolean;
  },
  tx: Tx = db,
) {
  await tx.activityLog.create({
    data: {
      userId: entry.userId ?? null,
      email: entry.email ?? null,
      action: entry.action,
      detail: entry.detail ?? "",
      ip: entry.ip ?? "",
      userAgent: entry.userAgent ?? "",
      suspicious: entry.suspicious ?? false,
    },
  });
}
