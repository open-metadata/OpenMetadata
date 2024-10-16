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

import { getCronInitialValue } from './CronUtils';

describe('getCronInitialValue function', () => {
  it('should generate day cron expression if appType is internal and appName is not DataInsightsReportApplication', () => {
    const result = getCronInitialValue('SearchIndexingApplication');

    expect(result).toEqual('0 0 * * *');
  });

  it('should generate week cron expression if appName is DataInsightsReportApplication', () => {
    const result = getCronInitialValue('DataInsightsReportApplication');

    expect(result).toEqual('0 0 * * 0');
  });

  it('should generate day cron expression if appType is external', () => {
    const result = getCronInitialValue('DataInsightsApplication');

    expect(result).toEqual('0 0 * * *');
  });
});
