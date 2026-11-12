import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { Icon } from "@/components/Icon";

export default async function LoginPage() {
  if (await getUser()) redirect("/tickets");
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-4">
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cardinal/10 text-cardinal">
            <Icon name="lock" />
          </span>
          <div>
            <h1 className="text-lg font-bold">Student sign-in</h1>
            <p className="muted">Simulated university single sign-on</p>
          </div>
        </div>
        <LoginForm />
      </div>
      <p className="px-2 text-center text-xs text-stone-500">
        Only enrolled students with an @usc.edu account can sign in. A one-time code is required every time.
      </p>
    </div>
  );
}
