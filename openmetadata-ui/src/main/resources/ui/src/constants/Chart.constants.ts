/*
 *  Copyright 2025 Collate.
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
import { Chart, ChartType } from '../generated/entity/data/chart';

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

export const CHART_DUMMY_DATA: Chart = {
  id: '21dd6360-d1f2-4810-8759-6ab92c4f033e',
  name: '31',
  displayName: 'Sales Chart',
  fullyQualifiedName: 'sample_superset.31',
  description: '',
  version: 0.1,
  updatedAt: 1743682276991,
  updatedBy: 'admin',
  chartType: ChartType.Line,
  sourceUrl: 'http://localhost:808/superset/chart/6/',
  owners: [],
  followers: [],
  tags: [],
  service: {
    id: '917a8613-8398-48e7-95dd-5e6c57027cc2',
    type: 'dashboardService',
    name: 'sample_superset',
    fullyQualifiedName: 'sample_superset',
    displayName: 'sample_superset',
    deleted: false,
  },
  usageSummary: {
    dailyStats: {
      count: 0,
      percentileRank: 0,
    },
    weeklyStats: {
      count: 0,
      percentileRank: 0,
    },
    monthlyStats: {
      count: 0,
      percentileRank: 0,
    },
    date: new Date('2025-04-03'),
  },
  deleted: false,
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
