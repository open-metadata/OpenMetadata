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

// Browser-only: imports react-dom/server, so never import it from `options/`.
import type { TooltipComponentFormatterCallbackParams } from 'echarts';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BAND_SERIES_SUFFIXES, REFERENCE_SERIES_ID } from './options/cartesian';
import { PIE_TRACK_SERIES_ID } from './options/pie';
import type { ChartTooltipItem, ChartTooltipProps } from './types';

/** Tooltip content for the hovered point. `datum` is the hovered row. */
export type ChartTooltipRender<D> = (
  items: ChartTooltipItem[],
  datum: D | undefined
) => ReactNode;

export interface ChartTooltipRenderProps<D> extends ChartTooltipProps {
  /**
   * React content for the tooltip. Rendered to static HTML, so it can hold
   * no state, effects or event handlers. Replaces `formatter`, and items carry
   * raw values: `valueFormatter` does not apply here.
   */
  render?: ChartTooltipRender<D>;
}

interface FormatterParam {
  componentSubType?: string;
  seriesId?: string;
  seriesName?: string;
  name?: string;
  value?: unknown;
  color?: unknown;
  dataIndex?: number;
}

// Helper series that are drawn but are not data.
const HIDDEN_SERIES = new Set([REFERENCE_SERIES_ID, PIE_TRACK_SERIES_ID]);

const isHelperSeries = (seriesId: string) =>
  HIDDEN_SERIES.has(seriesId) ||
  BAND_SERIES_SUFFIXES.some((suffix) => seriesId.endsWith(suffix));

// Time-axis points are [x, y]; the value is the last entry.
const itemValue = (value: unknown): number | string | null => {
  const last = Array.isArray(value) ? value[value.length - 1] : value;

  return typeof last === 'number' || typeof last === 'string' ? last : null;
};

const toItem = (param: FormatterParam): ChartTooltipItem => {
  const isPie = param.componentSubType === 'pie';

  return {
    seriesKey: String((isPie ? param.name : param.seriesId) ?? ''),
    name: String((isPie ? param.name : param.seriesName) ?? ''),
    value: itemValue(param.value),
    color: typeof param.color === 'string' ? param.color : '',
    dataIndex: param.dataIndex ?? 0,
  };
};

/** ECharts formatter params → one item per data series, helpers dropped. */
export const toTooltipItems = (
  params: TooltipComponentFormatterCallbackParams
): ChartTooltipItem[] =>
  (Array.isArray(params) ? params : [params])
    .map((param) => param as FormatterParam)
    .filter((param) => !isHelperSeries(String(param.seriesId)))
    .map(toItem);

/**
 * Turns `tooltip.render` into a string `formatter` ECharts can use, and makes
 * the tooltip bare so the rendered content brings its own card.
 */
export const withTooltipRender = <D,>(
  tooltip: ChartTooltipRenderProps<D> | undefined,
  data: readonly D[]
): ChartTooltipProps | undefined => {
  if (!tooltip?.render) {
    return tooltip;
  }
  const { render, ...rest } = tooltip;

  return {
    ...rest,
    bare: true,
    formatter: (params) => {
      const items = toTooltipItems(params);

      return items.length
        ? renderToStaticMarkup(<>{render(items, data[items[0].dataIndex])}</>)
        : '';
    },
  };
};
