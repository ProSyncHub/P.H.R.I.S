"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Shield } from "lucide-react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md border bg-cyan-400/10 text-cyan-300">
          <Shield className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">P.H.R.I.S Admin Access</CardTitle>
        <p className="text-sm text-muted-foreground">AI-powered employee performance intelligence system.</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <Input name="email" type="email" placeholder="admin@prosync.local" required />
          <Input name="password" type="password" placeholder="Password" required />
          {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
