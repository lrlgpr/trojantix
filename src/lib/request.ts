import "server-only";
import { headers } from "next/headers";

export async function clientInfo() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "127.0.0.1";
  const userAgent = h.get("user-agent") ?? "unknown";
  return { ip, userAgent };
}

/** Short, human-friendly device label from a user agent string. */
export function deviceLabel(ua: string) {
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : /curl|node|python/i.test(ua)
            ? "Script"
            : "Browser";
  return `${browser} on ${os}`;
}
