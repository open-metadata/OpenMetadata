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

import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';

let registered = false;

/**
 * Registers the chart types and components the charts module draws with on
 * the shared `echarts/core` instance. Importing the modular entries instead of
 * `echarts` keeps unused chart types out of the bundle. Safe to call often.
 */
export const registerChartParts = (): void => {
  if (registered) {
    return;
  }
  echarts.use([
    LineChart,
    BarChart,
    PieChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent,
    MarkLineComponent,
    AriaComponent,
    LabelLayout,
    SVGRenderer,
  ]);
  registered = true;
};

/**
 * Registers extra ECharts parts (e.g. heatmap, sankey, map) on the same core
 * instance `EChart` renders with, for callers that draw more than the typed
 * components cover.
 */
export const registerEChartsParts = (
  parts: Parameters<typeof echarts.use>[0]
): void => {
  echarts.use(parts);
};

export { echarts };
