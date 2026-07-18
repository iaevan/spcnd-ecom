/* TODO:security-blocked — see docs/SECURITY_WORK.md item S4 */
// The full @spacendigital/auth implementation (credential storage per
// DECISION-5, auth_sessions token issue/validate, roles & capabilities,
// optional OAuth wiring via Arctic, admin api_keys) replaces this stub in S4.

import { defineSpcndPlugin } from '@spacendigital/plugin-system';

/**
 * Stub plugin: registers nothing and rejects every credential-related call.
 * The admin SPA's login flow surfaces this message in dev until S4 lands.
 */
export const AuthPlugin = defineSpcndPlugin({
  id: 'spacendigital/auth',
  version: '0.1.0',
  setup({ log }) {
    log(
      'warn',
      'TODO:security-blocked — SECURITY_WORK item S4: @spacendigital/auth is a stub; all credential calls are no-ops and logins are rejected.',
    );
  },
});

/** Uniform rejection used by API/admin surfaces while the stub is active. */
export function authNotImplemented(): never {
  throw new Error(
    'Authentication is not available yet: @spacendigital/auth is the S4 stub (see docs/SECURITY_WORK.md).',
  );
}

export default AuthPlugin;
