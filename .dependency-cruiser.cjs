/** Enforces the dependency rules from docs/AGENTS.md §3.1. */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-no-impl-packages',
      comment: 'core only imports service interfaces it defines itself, never impl packages',
      severity: 'error',
      from: { path: '^packages/core/src' },
      to: {
        path: '^packages/(auth|payments|shipping|tax|email|reviews|analytics|api|compat-wc|cli|ui)/',
      },
    },
    {
      name: 'impls-never-import-each-other',
      severity: 'error',
      from: { path: '^packages/(auth|payments|shipping|tax|email|reviews|analytics)/src' },
      to: {
        path: '^packages/(auth|payments|shipping|tax|email|reviews|analytics)/',
        pathNot: '^packages/$1/',
      },
    },
    {
      name: 'core-no-frontend',
      severity: 'error',
      from: { path: '^packages/core/src' },
      to: { path: '^(apps/|packages/adapters/)' },
    },
    {
      name: 'packages-no-apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    exclude: { path: ['node_modules', 'dist', '\\.astro'] },
  },
};
