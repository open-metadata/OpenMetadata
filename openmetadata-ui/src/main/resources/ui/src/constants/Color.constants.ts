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
// keeping same name as variable.less

import { DEFAULT_THEME } from './Appearance.constants';

export const GREEN_1 = '#067647';
export const GREEN_3 = '#48ca9e';
export const GREEN_4 = '#039855';
export const GREEN_3_OPACITY = '#48ca9e30';
export const YELLOW_2 = '#ffbe0e';
export const YELLOW_3 = '#f79009';
export const RED_1 = '#F04438';
export const RED_3 = '#f24822';
export const RED_3_OPACITY = '#FF7C501A';
export const PURPLE_2 = '#7147e8';
export const TEXT_COLOR = '#414651';
export const WHITE_SMOKE = '#F8F8F8';
export const GRAY_1 = '#A1A1AA';
export const LIGHT_GRAY = '#F1F4F9';
export const INDIGO_1 = '#3538CD';
export const PRIMARY_COLOR = DEFAULT_THEME.primaryColor;
export const BLUE_1 = '#175cd3';
export const BLUE_2 = '#3ca2f4';
export const BLUE_500 = '#2E90FA';
export const BLUE_800 = '#1849A9';
export const BLUE_50 = '#EFF8FF';
export const CHART_BLUE_1 = '#4689FF';
export const RIPTIDE = '#76E9C6';
export const MY_SIN = '#FEB019';
export const SAN_MARINO = '#416BB3';
export const SILVER_TREE = '#5CAE95';
export const DESERT = '#B56727';
export const PINK_SALMON = '#FF92AE';
export const ELECTRIC_VIOLET = '#9747FF';
export const LEMON_ZEST = '#FFD700';
export const GREY_100 = '#f5f5f5';
export const GREY_200 = '#E9EAEB';
export const GRAY_600 = '#535862';

export const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  Severity1: {
    bg: 'rgba(222, 57, 49, 0.1)',
    color: '#9c0700',
  },
  Severity2: {
    bg: 'rgba(247, 99, 33, 0.1)',
    color: '#be3b00',
  },
  Severity3: {
    bg: 'rgba(255, 165, 33, 0.1)',
    color: '#c27400',
  },
  Severity4: {
    bg: 'rgba(255, 206, 41, 0.1)',
    color: '#ad8600',
  },
  Severity5: {
    bg: 'rgba(181, 198, 33, 0.1)',
    color: '#6e7343',
  },
  NoSeverity: {
    bg: 'rgba(154, 154, 154, 0.1)',
    color: '#6B7280',
  },
};

export const STATUS_COLORS: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  New: { bg: '#E1D3FF', color: '#7147E8', border: '#7147E8' },
  Ack: { bg: '#EBF6FE', color: '#3DA2F3', border: '#3DA2F3' },
  Assigned: { bg: '#FFF6E1', color: '#D99601', border: '#D99601' },
  Resolved: { bg: '#E8F5E9', color: '#4CAF50', border: '#81C784' },
};
