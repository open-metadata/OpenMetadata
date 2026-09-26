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
import { StepSummary } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getIngestionStatusCountData } from './IngestionConfigUtils';

const valueByType = (summary: StepSummary | undefined, type: string) =>
  getIngestionStatusCountData(summary).find((item) => item.type === type)
    ?.value;

describe('getIngestionStatusCountData', () => {
  it('should count updated_records as Success when records is 0 (e.g. Automator)', () => {
    // Automator runs report applied changes under updated_records, not records.
    const summary = {
      name: 'Automator',
      records: 0,
      updated_records: 30,
      warnings: 0,
      errors: 0,
    } as StepSummary;

    expect(valueByType(summary, 'success')).toBe('30');
  });

  it('should count records as Success for a normal run with no updates', () => {
    const summary = { name: 'Metadata', records: 5 } as StepSummary;

    expect(valueByType(summary, 'success')).toBe('5');
  });

  it('should sum records and updated_records (disjoint successes)', () => {
    const summary = {
      name: 'Metadata',
      records: 2,
      updated_records: 3,
    } as StepSummary;

    expect(valueByType(summary, 'success')).toBe('5');
  });

  it('should map errors to Failed and warnings to Warning', () => {
    const summary = {
      name: 'Automator',
      records: 0,
      updated_records: 30,
      errors: 4,
      warnings: 2,
    } as StepSummary;

    expect(valueByType(summary, 'failed')).toBe('4');
    expect(valueByType(summary, 'warning')).toBe('2');
  });

  it('should default every count to 0 when summary is undefined', () => {
    expect(valueByType(undefined, 'success')).toBe('0');
    expect(valueByType(undefined, 'failed')).toBe('0');
    expect(valueByType(undefined, 'warning')).toBe('0');
  });
});
