import { deepmerge } from 'deepmerge-ts';
import { allPlugins } from 'virtual:plugins';

import { restart } from '@/providers/app-controls';

import { defaultConfig } from './defaults';
import { store } from './store';

import type { PluginConfig } from '@/types/plugins';

/**
 * The stored plugin map with Lacquer's D11 default set (`defaults.ts`) merged
 * underneath.
 *
 * `electron-store` shallow-merges top-level keys, so the moment `config.json`
 * carries *any* `plugins` entry — which a Pear-derived or dev-built profile
 * always does — its own default for the whole `plugins` key is dropped, taking
 * the D11 table with it. That is why the table is re-applied here as a real
 * default *layer*: the user's stored choices still win on every key they have
 * actually set.
 */
export function getPlugins() {
  const stored = (store.get('plugins') ?? {}) as Record<string, PluginConfig>;
  return deepmerge(defaultConfig.plugins, stored) as Record<
    string,
    PluginConfig
  >;
}

export async function isEnabled(plugin: string) {
  const pluginConfig = deepmerge(
    (await allPlugins())[plugin]?.config ?? { enabled: false },
    getPlugins()[plugin] ?? {},
  );
  return pluginConfig !== undefined && pluginConfig.enabled;
}

/**
 * Set options for a plugin
 * @param plugin Plugin name
 * @param options Options to set
 * @param exclude Options to exclude from the options object
 */
export function setOptions<T>(
  plugin: string,
  options: T,
  exclude: string[] = ['enabled'],
) {
  const plugins = store.get('plugins') as Record<string, T>;
  // HACK: This is a workaround for preventing changed options from being overwritten
  exclude.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      delete options[key as keyof T];
    }
  });
  store.set('plugins', {
    ...plugins,
    [plugin]: {
      ...plugins[plugin],
      ...options,
    },
  });
}

export function setMenuOptions<T>(
  plugin: string,
  options: T,
  exclude: string[] = ['enabled'],
) {
  setOptions(plugin, options, exclude);
  if (store.get('options.restartOnConfigChanges')) {
    restart();
  }
}

export function getOptions<T>(plugin: string): T {
  return (getPlugins() as Record<string, T>)[plugin];
}

export function enable(plugin: string) {
  setMenuOptions(plugin, { enabled: true }, []);
}

export function disable(plugin: string) {
  setMenuOptions(plugin, { enabled: false }, []);
}
