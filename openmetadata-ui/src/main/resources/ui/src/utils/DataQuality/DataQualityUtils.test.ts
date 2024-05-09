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
import { ListTestCaseParamsBySearch } from '../../rest/testAPI';
import { buildTestCaseParams } from './DataQualityUtils';

jest.mock('../../constants/profiler.constant', () => ({
  TEST_CASE_FILTERS: {
    lastRun: 'lastRun',
    table: 'table',
    platform: 'platform',
    type: 'type',
    status: 'status',
  },
}));

describe('buildTestCaseParams', () => {
  it('should return an empty object if params is undefined', () => {
    const params = undefined;
    const filters = ['lastRun', 'table'];

    const result = buildTestCaseParams(params, filters);

    expect(result).toEqual({});
  });

  it('should return the updated test case parameters with the applied filters', () => {
    const params = {
      endTimestamp: 1234567890,
      startTimestamp: 1234567890,
      entityLink: 'table1',
      testPlatforms: ['DBT'],
    } as ListTestCaseParamsBySearch;
    const filters = ['lastRun', 'table'];

    const result = buildTestCaseParams(params, filters);

    expect(result).toEqual({
      endTimestamp: 1234567890,
      startTimestamp: 1234567890,
      entityLink: 'table1',
    });
  });
});
