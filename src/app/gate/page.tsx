import { requireAdmin } from "@/lib/auth";
import { Scanner } from "./Scanner";

export default async function GatePage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Gate scanner</h1>
        <p className="muted">Scan a student&apos;s live ticket QR, or paste a code. Codes expire every 15 seconds.</p>
      </div>
      <Scanner />
    </div>
  );
}
