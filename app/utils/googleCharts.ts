/**
 * Google Charts loading for the analysis charts.
 */

import { loadGoogleCharts } from 'vue-google-charts';

/**
 * Pass to every <GChart :settings>. vue-google-charts caches the library per
 * settings, so preloading with the same object means the charts don't wait.
 * Only ComboChart is used, so 'corechart' is enough (the default also loads 'table').
 */
export const GOOGLE_CHARTS_SETTINGS = { packages: ['corechart' as const] };

/**
 * Start downloading Google Charts in the background (≈11 files from gstatic)
 * so opening the chart tab doesn't wait for the network.
 */
export function preloadGoogleCharts(): void {
  if (import.meta.server) return;
  const load = () => loadGoogleCharts('current', GOOGLE_CHARTS_SETTINGS).catch(() => {});
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 3000 });
  else setTimeout(load, 1000);
}
