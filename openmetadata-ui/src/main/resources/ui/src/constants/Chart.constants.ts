/*
 *  Copyright 2024 Collate.
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

import { AreaChartColorScheme } from '../components/Visualisations/Chart/Chart.interface';
import { GREEN_3, RED_3, YELLOW_2 } from './Color.constants';
import { WHITE_COLOR } from './constants';

export const CHART_BASE_SIZE = 300;
export const CHART_SMALL_SIZE = 200;

export const ABORTED_CHART_COLOR_SCHEME: AreaChartColorScheme = {
  gradientEndColor: WHITE_COLOR,
  gradientStartColor: YELLOW_2,
  strokeColor: YELLOW_2,
};

export const FAILED_CHART_COLOR_SCHEME: AreaChartColorScheme = {
  gradientEndColor: WHITE_COLOR,
  gradientStartColor: RED_3,
  strokeColor: RED_3,
};

export const SUCCESS_CHART_COLOR_SCHEME: AreaChartColorScheme = {
  gradientEndColor: WHITE_COLOR,
  gradientStartColor: GREEN_3,
  strokeColor: GREEN_3,
};
