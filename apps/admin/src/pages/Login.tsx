import { Button, Card, Field, Input } from '@spacendigital/ui';
import { useState } from 'react';

/**
 * TODO:security-blocked — see docs/SECURITY_WORK.md items S4 / S7.
 * Login calls the auth package, which is the S4 stub: every attempt is
 * rejected with a security-blocked notice until credential storage and the
 * session API land. The form ships so the S7 wiring is a drop-in.
 */
export function LoginPage() {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm">
        <Card title="Sign in to spcnd-ecom">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setNotice(
                'Logins are not available yet: authentication is pending SECURITY_WORK items S4/S7.',
              );
            }}
          >
            <Field label="Email">
              <Input type="email" name="email" required autoComplete="username" />
            </Field>
            <Field label="Password">
              <Input type="password" name="password" required autoComplete="current-password" />
            </Field>
            {notice && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>
            )}
            <Button type="submit" className="w-full justify-center">
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
