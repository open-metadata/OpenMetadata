/*
 *  Copyright 2022 Collate.
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

import { AxiosError } from 'axios';
import { TabSpecificField } from '../enums/entity.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { ChartType } from '../pages/DashboardDetailsPage/DashboardDetailsPage.component';
import { getChartById } from '../rest/chartAPI';
import { sortTagsCaseInsensitive } from './CommonUtils';

export const defaultFields = `${TabSpecificField.DOMAIN},${TabSpecificField.OWNER}, ${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS}, ${TabSpecificField.CHARTS},
${TabSpecificField.VOTES},${TabSpecificField.DATA_PRODUCTS}`;

export const sortTagsForCharts = (charts: ChartType[]) => {
  return charts.map((chart) => ({
    ...chart,
    tags: sortTagsCaseInsensitive(chart.tags || []),
  }));
};

export const fetchCharts = async (charts: Dashboard['charts']) => {
  let chartsData: ChartType[] = [];
  let promiseArr: Array<Promise<ChartType>> = [];
  try {
    if (charts?.length) {
      promiseArr = charts.map((chart) => getChartById(chart.id, ['tags']));
      const res = await Promise.allSettled(promiseArr);

      if (res.length) {
        chartsData = res
          .filter((chart) => chart.status === 'fulfilled')
          .map((chart) => (chart as PromiseFulfilledResult<ChartType>).value);
      }
    }
  } catch (err) {
    throw new Error((err as AxiosError).message);
  }

  return chartsData;
};
