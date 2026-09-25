import { t } from '@/i18n';
import { signalChain } from '@/lacquer/signal-chain';
import { createPlugin } from '@/utils';

import emptyStyle from './empty-player.css?inline';
import {
  getButterchurnVisualizer,
  LacquerVisualizer,
  loadButterchurnVisualizer,
} from './visualizers';
import { resolveVisualizerType } from './visualizers/lacquer-state';
import { type Visualizer } from './visualizers/visualizer';

type WaveColor = {
  gradient: string[];
  rotate?: number;
};

export type VisualizerPluginConfig = {
  enabled: boolean;
  type: 'lacquer-orbital' | 'lacquer-rave' | 'butterchurn' | 'vudio' | 'wave';
  butterchurn: {
    preset: string;
    blendTimeInSeconds: number;
  };
  vudio: {
    effect: string;
    accuracy: number;
    lighting: {
      maxHeight: number;
      maxSize: number;
      lineWidth: number;
      color: string;
      shadowBlur: number;
      shadowColor: string;
      fadeSide: boolean;
      prettify: boolean;
      horizontalAlign: string;
      verticalAlign: string;
      dottify: boolean;
    };
  };
  wave: {
    animations: {
      type: string;
      config: {
        bottom?: boolean;
        top?: boolean;
        count?: number;
        cubeHeight?: number;
        lineWidth?: number;
        diameter?: number;
        fillColor?: string | WaveColor;
        lineColor?: string | WaveColor;
        radius?: number;
        frequencyBand?: string;
      };
    }[];
  };
};

type RenderProps = {
  visualizerInstance: Visualizer | null;
  audioContext: AudioContext | null;
  observer: ResizeObserver | null;
  audioCanPlayHandler: ((event: CustomEvent<Compressor>) => void) | null;
  /** Identifies the create call waiting on the lazily loaded Butterchurn. */
  pendingLoad: object | null;
};

type VisualizerRenderer = {
  props: RenderProps;
  destroyVisualizer(): void;
  createVisualizer(config: VisualizerPluginConfig): void;
};

export default createPlugin({
  name: () => t('plugins.visualizer.name'),
  description: () => t('plugins.visualizer.description'),
  restartNeeded: false,
  config: {
    enabled: false,
    type: 'lacquer-orbital',
    // Config per visualizer
    butterchurn: {
      preset: 'martin [shadow harlequins shape code] - fata morgana',
      blendTimeInSeconds: 2.7,
    },
    vudio: {
      effect: 'lighting',
      accuracy: 128,
      lighting: {
        maxHeight: 160,
        maxSize: 12,
        lineWidth: 1,
        color: '#49f3f7',
        shadowBlur: 2,
        shadowColor: 'rgba(244,244,244,.5)',
        fadeSide: true,
        prettify: false,
        horizontalAlign: 'center',
        verticalAlign: 'middle',
        dottify: true,
      },
    },
    wave: {
      animations: [
        {
          type: 'Cubes',
          config: {
            bottom: true,
            count: 30,
            cubeHeight: 5,
            fillColor: { gradient: ['#FAD961', '#F76B1C'] },
            lineColor: 'rgba(0,0,0,0)',
            radius: 20,
          },
        },
        {
          type: 'Cubes',
          config: {
            top: true,
            count: 12,
            cubeHeight: 5,
            fillColor: { gradient: ['#FAD961', '#F76B1C'] },
            lineColor: 'rgba(0,0,0,0)',
            radius: 10,
          },
        },
        {
          type: 'Circles',
          config: {
            lineColor: {
              gradient: ['#FAD961', '#FAD961', '#F76B1C'],
              rotate: 90,
            },
            lineWidth: 4,
            diameter: 20,
            count: 10,
            frequencyBand: 'base',
          },
        },
      ],
    },
  } as VisualizerPluginConfig,
  stylesheets: [emptyStyle],
  menu: async ({ getConfig, setConfig }) => {
    const config = await getConfig();
    const visualizerTypes = [
      ['lacquer-orbital', 'Orbital Shockwave'],
      ['lacquer-rave', 'Laser Basilica (Rave)'],
      ['butterchurn', 'Butterchurn (hide artwork)'],
    ] as const;

    return [
      {
        label: t('plugins.visualizer.menu.visualizer-type'),
        submenu: visualizerTypes.map(([visualizerType, label]) => ({
          label,
          type: 'radio',
          checked: resolveVisualizerType(config.type) === visualizerType,
          click() {
            setConfig({ type: visualizerType });
          },
        })),
      },
    ];
  },

  renderer: {
    props: {
      visualizerInstance: null,
      audioContext: null,
      observer: null,
      audioCanPlayHandler: null,
      pendingLoad: null,
    } as RenderProps,

    destroyVisualizer(this: VisualizerRenderer) {
      this.props.pendingLoad = null;
      this.props.observer?.disconnect();
      this.props.observer = null;
      this.props.visualizerInstance?.destroy();
      this.props.visualizerInstance = null;
      document.querySelector<HTMLCanvasElement>('#visualizer')?.remove();
    },

    createVisualizer(this: VisualizerRenderer, config: VisualizerPluginConfig) {
      this.destroyVisualizer();

      if (!this.props.audioContext) return;
      if (!config.enabled) return;

      const visualizerType = resolveVisualizerType(config.type);
      const ButterchurnVisualizer = getButterchurnVisualizer();
      if (visualizerType === 'butterchurn' && !ButterchurnVisualizer) {
        // Retry once the module is in, unless a later create/destroy has
        // superseded this request in the meantime.
        const request = {};
        this.props.pendingLoad = request;
        loadButterchurnVisualizer()
          .then(() => {
            if (this.props.pendingLoad === request)
              this.createVisualizer(config);
          })
          .catch((error: unknown) => {
            console.error('[Lacquer] Butterchurn failed to load', error);
          });
        return;
      }

      const takeover = document.documentElement.hasAttribute('data-lq-viz');
      const visualizerContainer = takeover
        ? document.documentElement
        : document.querySelector<HTMLElement>('#player');
      if (!visualizerContainer) {
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.id = 'visualizer';
      canvas.toggleAttribute('data-lq-viz-takeover', takeover);
      visualizerContainer.prepend(canvas);

      const analyserNode = signalChain.getAnalyserNode();
      const gainNode = this.props.audioContext.createGain();
      gainNode.gain.value = 1.0;
      analyserNode.connect(gainNode);

      try {
        this.props.visualizerInstance =
          visualizerType === 'butterchurn' && ButterchurnVisualizer
            ? new ButterchurnVisualizer(
                this.props.audioContext,
                analyserNode,
                canvas,
                gainNode,
                config,
              )
            : new LacquerVisualizer(
                this.props.audioContext,
                analyserNode,
                canvas,
                gainNode,
                visualizerType === 'lacquer-rave' ? 'rave' : 'orbital',
                takeover,
              );
      } catch (error) {
        analyserNode.disconnect(gainNode);
        gainNode.disconnect();
        canvas.remove();
        throw error;
      }

      const resizeVisualizer = () => {
        if (canvas && visualizerContainer) {
          const { width, height } = takeover
            ? { width: window.innerWidth, height: window.innerHeight }
            : visualizerContainer.getBoundingClientRect();
          this.props.visualizerInstance?.resize(width, height);
        }
      };
      resizeVisualizer();

      this.props.observer?.disconnect();
      this.props.observer = new ResizeObserver(resizeVisualizer);
      this.props.observer.observe(visualizerContainer);
    },

    onConfigChange(newConfig) {
      this.createVisualizer(newConfig);
    },

    async onPlayerApiReady(_, { getConfig }) {
      // Warm the lazily loaded Butterchurn module once startup has settled, so
      // opening the player does not wait on it when it is the chosen type.
      if (resolveVisualizerType((await getConfig()).type) === 'butterchurn') {
        requestIdleCallback(
          () => {
            loadButterchurnVisualizer().catch(() => undefined);
          },
          { timeout: 5000 },
        );
      }

      if (this.props.audioCanPlayHandler) {
        document.removeEventListener(
          'peard:audio-can-play',
          this.props.audioCanPlayHandler,
        );
      }
      this.props.audioCanPlayHandler = async (event) => {
        this.props.audioContext = event.detail.audioContext;
        this.createVisualizer(await getConfig());
      };
      document.addEventListener(
        'peard:audio-can-play',
        this.props.audioCanPlayHandler,
        { passive: true },
      );

      const audioContext = signalChain.getContext();
      if (audioContext) {
        this.props.audioContext = audioContext;
        this.createVisualizer(await getConfig());
      }
    },

    stop() {
      if (this.props.audioCanPlayHandler) {
        document.removeEventListener(
          'peard:audio-can-play',
          this.props.audioCanPlayHandler,
        );
        this.props.audioCanPlayHandler = null;
      }
      this.destroyVisualizer();
      this.props.audioContext = null;
    },
  },
});
