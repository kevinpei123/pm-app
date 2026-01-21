"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { inviteMember, type InviteState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Inviting..." : "Invite"}
    </Button>
  );
}

export default function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, formAction] = useActionState(
    inviteMember.bind(null, workspaceId),
    { ok: false, message: null } as InviteState
  );

  return (
    <Card className="space-y-3">
      <h3 className="text-lg font-semibold">Invite member</h3>
      <p className="text-sm text-zinc-500">They must already have signed up in your app.</p>

      <form action={formAction} className="flex flex-wrap gap-3">
        <Input name="email" placeholder="email@example.com" required />
        <SubmitButton />
      </form>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </Card>
  );
}
