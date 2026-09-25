import LacquerVisualizer from './lacquer';

type ButterchurnVisualizerClass = typeof import('./butterchurn').default;

// Butterchurn and its preset pack are ~1.3 MB and cost ~45 ms to evaluate on
// every full page load, but only the Butterchurn visualizer type uses them.
// They are evaluated the first time that type is actually drawn.
let butterchurnVisualizer: ButterchurnVisualizerClass | null = null;
let butterchurnLoad: Promise<ButterchurnVisualizerClass> | null = null;

export const getButterchurnVisualizer = () => butterchurnVisualizer;

export const loadButterchurnVisualizer = () =>
  (butterchurnLoad ??= import('./butterchurn').then((module) => {
    butterchurnVisualizer = module.default;
    return module.default;
  }));

export { LacquerVisualizer };
