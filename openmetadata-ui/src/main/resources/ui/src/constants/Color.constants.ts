/*
 *  Copyright 2023 Collate.
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
// Keeping the legacy export names avoids a broad consumer migration while the
// values move to the shared token cascade.
const WARNING_500 = 'var(--om-color-warning-500)';
const UTILITY_WARNING_700 = 'var(--om-color-utility-warning-700)';

export const TEST_STATUS_COLORS = {
  SUCCESS: 'var(--om-color-visualization-test-success)',
  FAILED: 'var(--om-color-error-500)',
  ABORTED: WARNING_500,
  QUEUED: 'var(--om-color-gray-700)',
};

export const GREEN_1 = 'var(--om-color-success-700)';
export const GREEN_6 = 'var(--om-color-success-600)';
export const GREEN_3 = 'var(--om-color-visualization-green-3)';
export const GREEN_4 = 'var(--om-color-visualization-green-4)';
export const GREEN_3_OPACITY =
  'var(--om-color-visualization-green-3-translucent)';
export const YELLOW_2 = 'var(--om-color-visualization-yellow-2)';
export const YELLOW_3 = WARNING_500;
export const RED_1 = 'var(--om-color-error-500)';
export const RED_3 = 'var(--om-color-visualization-red-3)';
export const RED_3_OPACITY = 'var(--om-color-visualization-red-3-translucent)';
export const PURPLE_2 = 'var(--om-color-visualization-purple-2)';
export const TEXT_COLOR = 'var(--om-color-text-secondary)';
export const GRAY_700 = 'var(--om-color-text-secondary)';
export const WHITE_SMOKE = 'var(--om-color-bg-secondary)';
export const GRAY_1 = 'var(--om-color-visualization-gray-1)';
export const LIGHT_GRAY = 'var(--om-color-bg-tertiary)';
export const INDIGO_1 = 'var(--om-color-indigo-700)';
export const PRIMARY_COLOR = 'var(--om-color-bg-brand-solid)';
export const BLUE_1 = 'var(--om-color-brand-700)';
export const BLUE_2 = 'var(--om-color-visualization-blue-2)';
export const BLUE_500 = 'var(--om-color-brand-500)';
export const BLUE_800 = 'var(--om-color-brand-800)';
export const BLUE_50 = 'var(--om-color-bg-brand)';
export const CHART_BLUE_1 = 'var(--om-color-visualization-chart-blue-1)';
export const BLUE_600 = 'var(--om-color-visualization-blue-600)';
export const BLUE_CHART_AREA_FILL = 'var(--om-color-bg-brand)';
export const CHART_CURSOR_STROKE = 'var(--om-color-border-secondary)';
export const RIPTIDE = 'var(--om-color-visualization-riptide)';
export const MY_SIN = 'var(--om-color-visualization-my-sin)';
export const SAN_MARINO = 'var(--om-color-visualization-san-marino)';
export const SILVER_TREE = 'var(--om-color-visualization-silver-tree)';
export const DESERT = 'var(--om-color-visualization-desert)';
export const PINK_SALMON = 'var(--om-color-visualization-pink-salmon)';
export const ELECTRIC_VIOLET = 'var(--om-color-visualization-electric-violet)';
export const LEMON_ZEST = 'var(--om-color-visualization-lemon-zest)';
export const GREY_100 = 'var(--om-color-bg-tertiary)';
export const GREY_200 = 'var(--om-color-border-secondary)';
export const GRAY_600 = 'var(--om-color-text-tertiary)';
export const COLOR_GREY_400 = 'var(--om-color-visualization-gray-400)';
export const COLOR_GREY_300 = 'var(--om-color-visualization-gray-300)';

// Data Quality dashboard chart palette (2.0 redesign shades)
export const DQ_CHART_SUCCESS_COLOR = 'var(--om-color-success-500)';
export const DQ_CHART_WARNING_COLOR = WARNING_500;
export const DQ_CHART_FAILED_COLOR = 'var(--om-color-visualization-dq-failed)';
export const DQ_CHART_BLUE_COLOR = 'var(--om-color-brand-600)';

export const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  Severity1: {
    bg: 'var(--om-color-utility-error-100)',
    color: 'var(--om-color-utility-error-700)',
  },
  Severity2: {
    bg: 'var(--om-color-utility-orange-100)',
    color: 'var(--om-color-utility-orange-700)',
  },
  Severity3: {
    bg: 'var(--om-color-utility-warning-100)',
    color: UTILITY_WARNING_700,
  },
  Severity4: {
    bg: 'var(--om-color-utility-yellow-100)',
    color: 'var(--om-color-utility-yellow-700)',
  },
  Severity5: {
    bg: 'var(--om-color-utility-green-100)',
    color: 'var(--om-color-utility-green-700)',
  },
  NoSeverity: {
    bg: 'var(--om-color-utility-gray-100)',
    color: 'var(--om-color-utility-gray-700)',
  },
};

export const STATUS_COLORS: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  New: {
    bg: 'var(--om-color-utility-purple-100)',
    color: 'var(--om-color-utility-purple-700)',
    border: 'var(--om-color-utility-purple-700)',
  },
  Ack: {
    bg: 'var(--om-color-utility-blue-light-100)',
    color: 'var(--om-color-utility-blue-light-700)',
    border: 'var(--om-color-utility-blue-light-700)',
  },
  Assigned: {
    bg: 'var(--om-color-utility-warning-100)',
    color: UTILITY_WARNING_700,
    border: UTILITY_WARNING_700,
  },
  Resolved: {
    bg: 'var(--om-color-utility-success-100)',
    color: 'var(--om-color-utility-success-700)',
    border: 'var(--om-color-utility-success-700)',
  },
};

// Canvas cannot evaluate CSS custom properties. The renderer resolves semantic
// tokens at draw time and uses these values only when the cascade is unavailable.
export const CANVAS_BUTTON_COLORS = {
  DEFAULT: {
    border: '#eaecf5',
    background: '#fff',
    icon: '#181d27',
  },
  SUCCESS: {
    border: '#00b871',
    background: '#effffb',
    icon: '#00b871',
  },
  FAILED: {
    border: '#cf1800',
    background: '#fcf0f1',
    icon: '#cf1800',
  },
  PENDING: {
    border: '#c18100',
    background: '#FFFBE6',
    icon: '#c18100',
  },
  HOVER: {
    border: '#2e90f9',
    background: '#fff',
    icon: '#2e90f9',
  },
} as const;
