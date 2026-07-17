import type { TypedBus } from './bus.js';
import type { Container } from './container.js';

/**
 * The minimal host surface a plugin's `setup()` receives. `@spcnd-ecom/core`'s
 * app kernel implements this; plugin-system itself has no dependency on core.
 */
export interface PluginHost {
  readonly bus: TypedBus;
  readonly container: Container;
  /** Platform capabilities available in this runtime (e.g. 'node:fs', 'queue'). */
  readonly capabilities: ReadonlySet<string>;
  readonly log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) => void;
}

export interface SpcndPluginManifest {
  /** Unique plugin id, e.g. 'my-org/gift-wrap'. */
  id: string;
  version: string;
  /** Plugin ids that must be set up before this one. */
  requires?: string[];
  /**
   * Capabilities the plugin needs (e.g. 'node:fs', 'payments.process').
   * The loader refuses to load the plugin on platforms missing one.
   */
  capabilities?: string[];
}

export interface SpcndPlugin extends SpcndPluginManifest {
  setup(host: PluginHost): void | Promise<void>;
  onActivate?(host: PluginHost): void | Promise<void>;
  onDeactivate?(host: PluginHost): void | Promise<void>;
  onInstall?(host: PluginHost): void | Promise<void>;
  onUninstall?(host: PluginHost): void | Promise<void>;
}

/**
 * Define a spcnd-ecom plugin.
 *
 * ```ts
 * export default defineSpcndPlugin({
 *   id: 'acme/gift-wrap',
 *   version: '1.0.0',
 *   setup({ bus }) {
 *     bus.on(orderCreated, async (order) => { ... });
 *   },
 * });
 * ```
 */
export function defineSpcndPlugin(plugin: SpcndPlugin): SpcndPlugin {
  if (!plugin.id) throw new Error('Plugin id is required');
  if (!plugin.version) throw new Error(`Plugin ${plugin.id}: version is required`);
  return plugin;
}

export class PluginLoadError extends Error {
  constructor(
    readonly pluginId: string,
    message: string,
  ) {
    super(`Plugin ${pluginId}: ${message}`);
    this.name = 'PluginLoadError';
  }
}

/**
 * Order plugins by their `requires` graph (topological), then set each up.
 * Missing capabilities or unresolved requirements throw `PluginLoadError`.
 */
export async function setupPlugins(plugins: SpcndPlugin[], host: PluginHost): Promise<void> {
  const byId = new Map(plugins.map((p) => [p.id, p]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: SpcndPlugin[] = [];

  const visit = (plugin: SpcndPlugin) => {
    if (visited.has(plugin.id)) return;
    if (visiting.has(plugin.id)) {
      throw new PluginLoadError(plugin.id, 'circular requires chain');
    }
    visiting.add(plugin.id);
    for (const dep of plugin.requires ?? []) {
      const found = byId.get(dep);
      if (!found) throw new PluginLoadError(plugin.id, `requires missing plugin "${dep}"`);
      visit(found);
    }
    visiting.delete(plugin.id);
    visited.add(plugin.id);
    ordered.push(plugin);
  };

  for (const plugin of plugins) visit(plugin);

  for (const plugin of ordered) {
    for (const capability of plugin.capabilities ?? []) {
      if (!host.capabilities.has(capability)) {
        throw new PluginLoadError(plugin.id, `platform is missing capability "${capability}"`);
      }
    }
    await plugin.setup(host);
  }
}
