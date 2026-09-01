/*
 * Generates Lacquer's mark: a laurel wreath around a stylised L whose foot
 * sweeps into a spectral groove.
 *
 * One geometry source, three outputs — the app icon, a de-wreathed glyph for
 * small icon sizes (a wreath is illegible below ~32px), and the titlebar
 * lockup pasted into `titlebar.ts`.
 *
 *   node scripts/make-logo.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rad = (d) => (d * Math.PI) / 180;

const branch = ({ cx, cy, r, from, to, count, leaf, side, ink }) => {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const theta = (from + ((to - from) * i) / (count - 1)) * side;
    const x = cx + r * Math.sin(rad(theta));
    const y = cy - r * Math.cos(rad(theta));
    const len = leaf * (0.62 + 0.38 * Math.sin((Math.PI * i) / (count - 1)));
    // +x aligns to outward-radial at (theta - 90); splay toward the opening.
    const a = theta - 90 - 30 * side;
    out.push(
      `<path d="M0 0 C ${(len * 0.26).toFixed(2)} ${(-len * 0.44).toFixed(2)}, ${(len * 0.78).toFixed(2)} ${(-len * 0.44).toFixed(2)}, ${len.toFixed(2)} 0 C ${(len * 0.78).toFixed(2)} ${(len * 0.44).toFixed(2)}, ${(len * 0.26).toFixed(2)} ${(len * 0.44).toFixed(2)}, 0 0 Z" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a.toFixed(2)})" fill="${ink}"/>`,
    );
  }
  const p = (t) => [
    cx + r * Math.sin(rad(t * side)),
    cy - r * Math.cos(rad(t * side)),
  ];
  const [x0, y0] = p(from);
  const [x1, y1] = p(to);
  out.push(
    `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 ${side === 1 ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="${ink}" stroke-width="${(r * 0.045).toFixed(2)}" stroke-linecap="round"/>`,
  );
  return out.join('\n    ');
};

const wreath = (o) =>
  branch({ ...o, from: 32, to: 168, side: 1 }) +
  '\n    ' +
  branch({ ...o, from: 32, to: 168, side: -1 });

/** The L, with its foot continuing into a groove sweep. */
const glyph = ({ cx, cy, r, ink, spectrum, weight = 0.26 }) => {
  const w = r * weight;
  const top = cy - r * 0.86,
    bot = cy + r * 0.7;
  const left = cx - r * 0.42,
    right = cx + r * 0.66;
  return `<path d="M${left.toFixed(2)} ${top.toFixed(2)} h${w.toFixed(2)} v${(bot - top - w).toFixed(2)} h${(right - left - w).toFixed(2)} v${w.toFixed(2)} h${(-(right - left)).toFixed(2)} Z" fill="${ink}"/>
    <path d="M${(left + w * 0.5).toFixed(2)} ${(bot + r * 0.34).toFixed(2)} A ${(r * 0.92).toFixed(2)} ${(r * 0.92).toFixed(2)} 0 0 0 ${(cx + r * 0.9).toFixed(2)} ${(cy - r * 0.1).toFixed(2)}" fill="none" stroke="${spectrum}" stroke-width="${(r * 0.17).toFixed(2)}" stroke-linecap="round"/>`;
};

const SPECTRUM = `<linearGradient id="lqSpectrum" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#4f7dff"/><stop offset="0.4" stop-color="#39d4d0"/>
      <stop offset="0.72" stop-color="#8a63f6"/><stop offset="1" stop-color="#ff9654"/>
    </linearGradient>`;

const doc = ({
  withWreath,
  plate,
  cx = 50,
  cy = 52,
}) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>${SPECTRUM}</defs>
  ${plate ? '<rect x="2" y="2" width="96" height="96" rx="22" fill="#0b1731"/>' : ''}
    ${withWreath ? wreath({ cx, cy, r: 38, count: 8, leaf: 14, ink: '#e8eff5' }) : ''}
    ${glyph({ cx, cy, r: withWreath ? 23 : 34, ink: '#e8eff5', spectrum: 'url(#lqSpectrum)', weight: withWreath ? 0.26 : 0.24 })}
</svg>
`;

writeFileSync(
  path.join(ROOT, 'assets/icon.svg'),
  doc({ withWreath: true, plate: true }),
);
writeFileSync(
  path.join(ROOT, 'assets/icon-small.svg'),
  doc({ withWreath: false, plate: true }),
);
console.log('[logo] wrote assets/icon.svg and assets/icon-small.svg');
