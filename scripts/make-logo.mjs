/*
 * Generates Lacquer's complete identity family from the approved Orbit Noir
 * script-L geometry: a full laurel crest for >=32px, a weighted de-wreathed
 * glyph below 32px, and the matching titlebar lockup.
 *
 *   node scripts/make-logo.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CHAMPAGNE = '#dac0a7';
const BRONZE = '#c38242';

const PLATE = `<defs>
    <radialGradient id="lqPlate" cx="34%" cy="24%" r="90%">
      <stop offset="0" stop-color="#173a6a"/>
      <stop offset=".58" stop-color="#0b1731"/>
      <stop offset="1" stop-color="#070f22"/>
    </radialGradient>
  </defs>
  <rect data-lq-layer="plate" x="2" y="2" width="96" height="96" rx="22" fill="url(#lqPlate)"/>`;

const FULL_SCRIPT_PATH =
  'M55.2 60.8C58.4 51.7 62.1 41.4 67.6 32.6C72.2 25.3 78.3 20.8 82 23.7C85.7 26.7 81.7 35.5 74.1 43.4C68.7 49 62.1 53.9 55.2 57.2M56.2 56.1C48.1 58.8 37.7 59.5 33.7 55.4C28.3 49.8 36.1 41.7 50.7 37.4M55 58.2C50.6 72.2 45.4 80.7 38.4 83.4C30.7 86.4 23.4 80.1 24.7 72.9C26 65.8 33.4 65 41.4 72.4C51.3 81.5 63.3 87 75.7 86.3C87.8 85.7 92.1 80.4 87.8 72.8';

const SMALL_SCRIPT_PATH =
  'M53.8 61.8C57.3 50.5 61.5 39.2 67.4 30.6C73 22.3 80.3 20.2 82.2 24.9C84.1 29.6 76.2 43.3 55 57.9M55 56.7C44.2 60.4 33.4 58.8 32.7 53.2C32 47.6 39.6 40.4 50.5 37.5M54.7 58.8C50.2 72.7 44.6 81.3 37.2 83.1C29.6 85 23.7 79 25.2 72C26.8 64.9 34.2 65.4 41.8 72.7C52.6 83 65.1 87.2 77.3 85.8C88.4 84.5 91.6 78.6 87.2 72';

const LAUREL = `<g data-lq-layer="laurel" fill="${CHAMPAGNE}">
    <path d="M14 78C8 58 13 32 31 16M86 78C92 58 87 32 69 16M14 78C28 88 72 88 86 78" fill="none" stroke="${CHAMPAGNE}" stroke-width="2.6" stroke-linecap="round"/>
    <g transform="translate(17 70) rotate(-53)"><ellipse rx="7.8" ry="3.4"/></g><g transform="translate(12.5 59) rotate(-42)"><ellipse rx="7.4" ry="3.2"/></g><g transform="translate(13.5 47) rotate(-29)"><ellipse rx="7" ry="3.1"/></g><g transform="translate(17.5 36) rotate(-17)"><ellipse rx="6.8" ry="3"/></g><g transform="translate(24 26.5) rotate(-5)"><ellipse rx="6.5" ry="2.9"/></g><g transform="translate(30.5 19) rotate(15)"><ellipse rx="6.1" ry="2.8"/></g>
    <g transform="translate(20 75) rotate(22)"><ellipse rx="7.6" ry="3.3"/></g><g transform="translate(17 64) rotate(34)"><ellipse rx="7.2" ry="3.2"/></g><g transform="translate(18.5 52) rotate(46)"><ellipse rx="6.8" ry="3"/></g><g transform="translate(23 41) rotate(58)"><ellipse rx="6.5" ry="2.9"/></g><g transform="translate(29.5 31.5) rotate(69)"><ellipse rx="6.1" ry="2.8"/></g>
    <g transform="translate(83 70) rotate(53)"><ellipse rx="7.8" ry="3.4"/></g><g transform="translate(87.5 59) rotate(42)"><ellipse rx="7.4" ry="3.2"/></g><g transform="translate(86.5 47) rotate(29)"><ellipse rx="7" ry="3.1"/></g><g transform="translate(82.5 36) rotate(17)"><ellipse rx="6.8" ry="3"/></g><g transform="translate(76 26.5) rotate(5)"><ellipse rx="6.5" ry="2.9"/></g><g transform="translate(69.5 19) rotate(-15)"><ellipse rx="6.1" ry="2.8"/></g>
    <g transform="translate(80 75) rotate(-22)"><ellipse rx="7.6" ry="3.3"/></g><g transform="translate(83 64) rotate(-34)"><ellipse rx="7.2" ry="3.2"/></g><g transform="translate(81.5 52) rotate(-46)"><ellipse rx="6.8" ry="3"/></g><g transform="translate(77 41) rotate(-58)"><ellipse rx="6.5" ry="2.9"/></g><g transform="translate(70.5 31.5) rotate(-69)"><ellipse rx="6.1" ry="2.8"/></g>
  </g>`;

const layeredScript = ({
  pathData,
  bronzeWidth,
  champagneWidth,
  classes = false,
}) => {
  const bronze = classes
    ? 'class="lq-mark-script-bronze"'
    : `stroke="${BRONZE}"`;
  const champagne = classes
    ? 'class="lq-mark-script-champagne"'
    : `stroke="${CHAMPAGNE}"`;
  return `<path data-lq-layer="script-shadow" d="${pathData}" fill="none" ${bronze} stroke-width="${bronzeWidth}" stroke-linecap="round" stroke-linejoin="round" transform="translate(-1.5 1.4)"/>
  <path data-lq-layer="script" d="${pathData}" fill="none" ${champagne} stroke-width="${champagneWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

const fullMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${PLATE}
  ${LAUREL}
  ${layeredScript({
    pathData: FULL_SCRIPT_PATH,
    bronzeWidth: 7.1,
    champagneWidth: 5.6,
  })}
</svg>
`;

const smallMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${PLATE}
  ${layeredScript({
    pathData: SMALL_SCRIPT_PATH,
    bronzeWidth: 9,
    champagneWidth: 7.2,
  })}
</svg>
`;

const titlebarMark = `<svg class="lq-wordmark-svg" viewBox="0 0 146 32" role="img" aria-label="Lacquer">
  <g class="lq-mark" transform="scale(.32)">
    <rect class="lq-mark-plate" x="2" y="2" width="96" height="96" rx="22"></rect>
    ${layeredScript({
      pathData: SMALL_SCRIPT_PATH,
      bronzeWidth: 9,
      champagneWidth: 7.2,
      classes: true,
    })}
  </g>
  <text class="lq-wordmark-text" x="38" y="21">acquer</text>
</svg>`;

export const iconVariantForSize = (size) => (size < 32 ? 'small' : 'full');

const trayMark = ({ paused, white }) => {
  const plate = white ? '' : PLATE;
  const bronze = white ? '#ffffff' : BRONZE;
  const champagne = white ? '#ffffff' : CHAMPAGNE;
  const badge = paused
    ? `
  <g data-lq-layer="pause">
    <circle cx="78" cy="78" r="17" fill="${white ? '#ffffff' : CHAMPAGNE}" stroke="#0b1731" stroke-width="3"/>
    <rect x="71.5" y="69" width="4.5" height="18" rx="2" fill="#0b1731"/>
    <rect x="80" y="69" width="4.5" height="18" rx="2" fill="#0b1731"/>
  </g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${plate}
  <path data-lq-layer="script-shadow" d="${SMALL_SCRIPT_PATH}" fill="none" stroke="${bronze}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" transform="translate(-1.5 1.4)"/>
  <path data-lq-layer="script" d="${SMALL_SCRIPT_PATH}" fill="none" stroke="${champagne}" stroke-width="7.2" stroke-linecap="round" stroke-linejoin="round"/>
  ${badge}
</svg>
`;
};

export const renderTraySources = () => ({
  playing: trayMark({ paused: false, white: false }),
  paused: trayMark({ paused: true, white: false }),
  playingWhite: trayMark({ paused: false, white: true }),
  pausedWhite: trayMark({ paused: true, white: true }),
});

export const renderLogoSources = () => ({
  full: fullMark,
  small: smallMark,
  titlebar: titlebarMark,
});

const generatedTitlebarModule = (svg) =>
  `/* Generated by scripts/make-logo.mjs. Do not edit by hand. */
export const WORDMARK_SVG = \`${svg}\`;
`;

export const writeLogoSources = (root = ROOT) => {
  const sources = renderLogoSources();
  writeFileSync(path.join(root, 'assets/icon.svg'), sources.full);
  writeFileSync(path.join(root, 'assets/icon-small.svg'), sources.small);
  writeFileSync(
    path.join(root, 'src/lacquer/logo.generated.ts'),
    generatedTitlebarModule(sources.titlebar),
  );
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  writeLogoSources();
  console.log(
    '[logo] wrote full, small, and titlebar marks from the approved script-L geometry',
  );
}
