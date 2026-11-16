/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/**
 * Window event `EChart` listens to: every chart hides its open tooltip.
 */
export const HIDE_CHART_TOOLTIPS_EVENT = 'om-charts:hide-tooltips';

/**
 * Hides every open chart tooltip. ECharts appends tooltips to `<body>`, so a
 * chart that is hidden without unmounting — a kept-alive route that goes
 * inactive — would otherwise leave its tooltip floating over the next page
 * until the pointer moves. Exported from the root entry too, so a caller can
 * fire it without loading echarts.
 */
export const hideChartTooltips = (): void => {
  window.dispatchEvent(new Event(HIDE_CHART_TOOLTIPS_EVENT));
};
