import { t } from '@/i18n';
import { signalChain } from '@/lacquer/signal-chain';
import { type MusicPlayer } from '@/types/music-player';
import { createPlugin } from '@/utils';

const ensureAudioContextLoad = (playerApi: MusicPlayer) => {
  if (playerApi.getPlayerState() !== 1 || signalChain.getContext()) return;

  playerApi.loadVideoById(
    playerApi.getPlayerResponse().videoDetails.videoId,
    playerApi.getCurrentTime(),
    playerApi.getUserPlaybackQualityPreference(),
  );
};

export default createPlugin({
  name: () => t('plugins.audio-compressor.name'),
  description: () => t('plugins.audio-compressor.description'),

  renderer: {
    onPlayerApiReady(playerApi) {
      ensureAudioContextLoad(playerApi);
    },

    start() {
      signalChain.setCompressor({
        threshold: -50,
        ratio: 12,
        knee: 40,
        attack: 0,
        release: 0.25,
      });
    },

    stop() {
      signalChain.bypassCompressor();
    },
  },
});
