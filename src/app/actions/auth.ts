"use server";

import { redirect } from "next/navigation";
import { startLogin, verifyLogin, logout, logoutOtherSessions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type FormState = { error?: string; ok?: string } | null;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const res = await startLogin(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!res.ok) return { error: res.error };
  redirect("/login/verify");
}

export async function verifyAction(_: FormState, form: FormData): Promise<FormState> {
  const res = await verifyLogin(String(form.get("code") ?? ""));
  if (!res.ok) return { error: res.error };
  redirect("/tickets");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

export async function logoutOthersAction(): Promise<void> {
  await logoutOtherSessions();
  revalidatePath("/activity");
}
