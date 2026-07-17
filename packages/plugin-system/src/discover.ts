import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SpcndPlugin } from './plugin.js';

export interface DiscoveredPlugin {
  packageName: string;
  entry: string;
  plugin: SpcndPlugin;
}

interface PackageJsonWithMeta {
  name?: string;
  ['spcnd-ecom']?: { kind?: string; entry?: string };
}

/**
 * Scan `node_modules` for packages declaring
 * `package.json["spcnd-ecom"] = { kind: "plugin", entry: "./dist/index.js" }`
 * and import each entry's default export as a plugin.
 *
 * Auto-discovery is **opt-in** (docs/AGENTS.md §7.1): callers only invoke this
 * when `autoDiscoverPlugins: true` is set in config or chosen in the init TUI.
 */
export async function discoverPlugins(rootDir = process.cwd()): Promise<DiscoveredPlugin[]> {
  const nodeModules = join(rootDir, 'node_modules');
  if (!existsSync(nodeModules)) return [];
  const found: DiscoveredPlugin[] = [];

  const candidates: string[] = [];
  for (const name of readdirSync(nodeModules)) {
    if (name.startsWith('.')) continue;
    if (name.startsWith('@')) {
      const scopeDir = join(nodeModules, name);
      for (const scoped of readdirSync(scopeDir)) {
        candidates.push(join(scopeDir, scoped));
      }
    } else {
      candidates.push(join(nodeModules, name));
    }
  }

  for (const dir of candidates) {
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    let pkg: PackageJsonWithMeta;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJsonWithMeta;
    } catch {
      continue;
    }
    const meta = pkg['spcnd-ecom'];
    if (meta?.kind !== 'plugin' || !meta.entry || !pkg.name) continue;
    const entryPath = join(dir, meta.entry);
    const mod = (await import(pathToFileURL(entryPath).href)) as { default?: SpcndPlugin };
    if (mod.default?.id && typeof mod.default.setup === 'function') {
      found.push({ packageName: pkg.name, entry: entryPath, plugin: mod.default });
    }
  }
  return found;
}
