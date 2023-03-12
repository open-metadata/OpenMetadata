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

import { cloneDeep } from 'lodash';
import { sortTagsForCharts } from './DashboardDetailsUtils';
import { mockCharts, sortedTagsMockCharts } from './DashboardDetailsUtils.mock';

describe('Tests for DashboardDetailsUtils', () => {
  describe('Tests for sortTagsForCharts function', () => {
    it('Input of unsorted array to sortTagsForCharts should return charts array with sorted order of tags by tagsFQN', () => {
      expect(sortTagsForCharts(cloneDeep(mockCharts))).toEqual(
        sortedTagsMockCharts
      );
    });

    it('Input of sorted array to sortTagsForCharts should return charts array with sorted order of tags by tagsFQN', () => {
      expect(sortTagsForCharts(cloneDeep(sortedTagsMockCharts))).toEqual(
        sortedTagsMockCharts
      );
    });

    it('The Array returned by sortTagsForCharts should not be eqaul to the unsorted input array', () => {
      expect(sortTagsForCharts(cloneDeep(mockCharts))).not.toEqual(mockCharts);
    });
  });
});
