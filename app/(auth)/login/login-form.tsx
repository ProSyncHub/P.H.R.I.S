"use client";

import Image from "next/image";
import { useFormState, useFormStatus } from "react-dom";
import { Shield } from "lucide-react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { brand, usageDisclaimer } from "@/lib/branding";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={pending}>
      <Shield className="h-4 w-4" />
      {pending ? "Authenticating" : "Login"}
    </Button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState(loginAction, {});
  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <div className="mb-3 flex items-center gap-3">
          <div className="relative h-11 w-11 overflow-hidden rounded-md border bg-background/70">
            <Image src={brand.logoPath} alt={`${brand.companyName} logo`} fill className="object-contain p-1" sizes="44px" priority />
          </div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-cyan-400/10 text-cyan-300">
            <Shield className="h-5 w-5" />
          </div>
        </div>
        <CardTitle className="text-xl">{brand.appName} Admin Access</CardTitle>
        <p className="text-sm text-muted-foreground">{brand.tagline}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <Input name="email" type="email" placeholder="admin@prosync.local" required />
          <Input name="password" type="password" placeholder="Password" required />
          {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
          <SubmitButton />
        </form>
        <div className="mt-6 rounded-md border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Usage Disclaimer</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {usageDisclaimer.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
