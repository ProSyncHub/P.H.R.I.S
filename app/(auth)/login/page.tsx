import { LoginForm } from "./login-form";
import { brand } from "@/lib/branding";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-slate-950 to-black px-6 py-10">
      <div className="w-full max-w-xl space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{brand.companyName}</h1>
          <p className="text-sm text-muted-foreground">{brand.appName} Secure Access Portal</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
