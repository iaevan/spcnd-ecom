/**
 * @spacendigital/next — stub (docs/AGENTS.md §10: "next = later, stub in v1").
 * The app-router integration (route handler mount + RSC helpers) is planned;
 * use @spacendigital/react against the HTTP API meanwhile.
 */
export function createNextHandler(): never {
  throw new Error(
    '@spacendigital/next is a v1 stub. Mount the Hono app via a route handler and use @spacendigital/react for now.',
  );
}
