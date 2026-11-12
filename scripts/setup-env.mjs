// Creates .env from .env.example with a fresh random APP_SECRET (skips if .env exists).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env")) {
  console.log(".env already exists, leaving it alone.");
} else {
  const env = readFileSync(".env.example", "utf8").replace(
    /APP_SECRET=".*"/,
    `APP_SECRET="${randomBytes(32).toString("hex")}"`,
  );
  writeFileSync(".env", env);
  console.log("Created .env with a random APP_SECRET. Add STRIPE_SECRET_KEY (sk_test_...) to use Stripe test mode.");
}
