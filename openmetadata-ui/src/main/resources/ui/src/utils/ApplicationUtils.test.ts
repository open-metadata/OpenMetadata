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

import { EntityStats } from '../components/Settings/Applications/AppLogsViewer/AppLogsViewer.interface';
import { AppRunRecord } from '../generated/entity/applications/appRunRecord';
import {
  getAppRunFailureLogs,
  getEntityStatsData,
  hasAppRunStats,
} from './ApplicationUtils';
import { MOCK_APPLICATION_ENTITY_STATS } from './mocks/ApplicationUtils.mock';

describe('ApplicationUtils tests', () => {
  it('getEntityStatsData should return stats data in array with vector embeddings', () => {
    const resultData = getEntityStatsData(
      MOCK_APPLICATION_ENTITY_STATS as unknown as EntityStats
    );

    // Verify basic structure
    expect(resultData.length).toBeGreaterThan(0);

    // Verify sorted by name
    for (let i = 1; i < resultData.length; i++) {
      expect(
        resultData[i - 1].name.localeCompare(resultData[i].name)
      ).toBeLessThanOrEqual(0);
    }

    // Verify each entry has required fields including vectorEmbeddings
    for (const entry of resultData) {
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('totalRecords');
      expect(entry).toHaveProperty('successRecords');
      expect(entry).toHaveProperty('failedRecords');
      expect(entry).toHaveProperty('vectorEmbeddings');
    }

    // Verify vector-indexable entities get a number (0 when no vectorSuccessRecords in mock)
    const tableEntry = resultData.find((e) => e.name === 'Table');

    expect(tableEntry?.vectorEmbeddings).toBe(0);

    // Verify non-vector-indexable entities get null
    const userEntry = resultData.find((e) => e.name === 'User');

    expect(userEntry?.vectorEmbeddings).toBeNull();

    const classificationEntry = resultData.find(
      (e) => e.name === 'Classification'
    );

    expect(classificationEntry?.vectorEmbeddings).toBeNull();
  });
});

describe('hasAppRunStats', () => {
  it('returns true when the success context has any stat block', () => {
    const record = {
      successContext: { stats: { jobStats: { totalRecords: 1 } } },
    } as unknown as AppRunRecord;

    expect(hasAppRunStats(record)).toBe(true);
  });

  it('returns true when the failure context has a stat block', () => {
    const record = {
      failureContext: { stats: { readerStats: { totalRecords: 1 } } },
    } as unknown as AppRunRecord;

    expect(hasAppRunStats(record)).toBe(true);
  });

  it('returns true when there are server stats', () => {
    const record = {
      successContext: { serverStats: { 's-1': { processedRecords: 1 } } },
    } as unknown as AppRunRecord;

    expect(hasAppRunStats(record)).toBe(true);
  });

  it('returns false when the record has only a failure and no stats', () => {
    const record = {
      failureContext: { failure: { message: 'boom' }, stackTrace: 'boom' },
    } as unknown as AppRunRecord;

    expect(hasAppRunStats(record)).toBe(false);
  });

  it('returns false when the record is empty', () => {
    expect(hasAppRunStats({} as AppRunRecord)).toBe(false);
  });
});

describe('getAppRunFailureLogs', () => {
  it('formats the failure object into readable log text', () => {
    const record = {
      failureContext: { failure: { message: 'oops' } },
    } as unknown as AppRunRecord;

    expect(getAppRunFailureLogs(record)).toContain('oops');
  });

  it('prefers stackTrace over failure', () => {
    const record = {
      failureContext: {
        stackTrace: 'boom-trace',
        failure: { message: 'oops' },
      },
    } as unknown as AppRunRecord;

    // stackTrace wins, so the failure message is not present
    expect(getAppRunFailureLogs(record)).not.toContain('oops');
  });

  it('returns an empty string when there is no failure context', () => {
    expect(getAppRunFailureLogs({} as AppRunRecord)).toBe('');
  });
});
