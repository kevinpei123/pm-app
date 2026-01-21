"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SignUp() {
  const r = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Sign up</h1>
        <p className="text-sm text-zinc-500">Create your account.</p>
      </div>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          const res = await authClient.signUp.email({ name, email, password, callbackURL: "/workspaces" });
          if (res.error) {
          setErr(res.error.message ?? "Authentication failed");
          return;
          }
          setErr(null);
          r.push("/workspaces");
        }}
      >
        <Card className="space-y-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit">Create account</Button>
        </Card>
      </form>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
