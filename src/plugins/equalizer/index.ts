import { t } from '@/i18n';
import { signalChain } from '@/lacquer/signal-chain';
import { createPlugin } from '@/utils';

import {
  defaultPresets,
  presetConfigs,
  type Preset,
  type FilterConfig,
} from './presets';

import type { MenuTemplate } from '@/menu';
import type { MenuContext } from '@/types/contexts';

export type EqualizerPluginConfig = {
  enabled: boolean;
  filters: FilterConfig[];
  presets: { [preset in Preset]: boolean };
};

const applyFilters = (config: EqualizerPluginConfig) => {
  const filtersToApply = config.filters.concat(
    defaultPresets
      .filter((preset) => config.presets[preset])
      .map((preset) => presetConfigs[preset]),
  );
  signalChain.setEQ(filtersToApply);
};

export default createPlugin({
  name: () => t('plugins.equalizer.name'),
  description: () => t('plugins.equalizer.description'),
  restartNeeded: false,
  addedVersion: '3.7.X',
  config: {
    enabled: false,
    filters: [],
    presets: { 'bass-booster': false },
  } as EqualizerPluginConfig,
  menu: async ({
    getConfig,
    setConfig,
  }: MenuContext<EqualizerPluginConfig>): Promise<MenuTemplate> => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.equalizer.menu.presets.label'),
        type: 'submenu',
        submenu: defaultPresets.map((preset) => ({
          label: t(`plugins.equalizer.menu.presets.list.${preset}`),
          type: 'radio',
          checked: config.presets[preset],
          click() {
            const newConfig = {
              presets: { ...config.presets, [preset]: !config.presets[preset] },
            };
            setConfig(newConfig);
          },
        })),
      },
    ];
  },
  renderer: {
    async start({ getConfig }) {
      const config = await getConfig();
      applyFilters(config);
    },
    stop() {
      signalChain.setEQ([]);
    },
    onConfigChange(config: EqualizerPluginConfig) {
      applyFilters(config);
    },
  },
});
