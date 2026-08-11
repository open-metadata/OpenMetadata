/*
 *  Copyright 2026 Collate.
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
import { renderHook } from '@testing-library/react';
import { TestSummary } from '../../../generated/tests/testSuite';
import {
  TestSummaryCardKey,
  TestSummarySegmentId,
} from './SummaryPanel.interface';
import { useTestSummaryCards } from './useTestSummaryCards';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { entity?: string }) =>
      options?.entity ? `${key}:${options.entity}` : key,
  }),
}));

const sampleSummary = {
  total: 100,
  success: 80,
  failed: 15,
  aborted: 5,
  healthy: 40,
  totalDQEntities: 50,
  totalEntityCount: 200,
} as TestSummary;

describe('useTestSummaryCards', () => {
  it('should derive the three summary cards in order', () => {
    const { result } = renderHook(() => useTestSummaryCards(sampleSummary));

    expect(result.current.map((card) => card.key)).toEqual([
      TestSummaryCardKey.TotalTests,
      TestSummaryCardKey.Healthy,
      TestSummaryCardKey.Coverage,
    ]);
  });

  it('should compute the primary value and percentage for each card', () => {
    const { result } = renderHook(() => useTestSummaryCards(sampleSummary));
    const [tests, healthy, coverage] = result.current;

    expect([tests.value, healthy.value, coverage.value]).toEqual([100, 40, 50]);
    // success/total, healthy/totalDQEntities, totalDQEntities/totalEntityCount
    expect([tests.percentage, healthy.percentage, coverage.percentage]).toEqual(
      ['80%', '80%', '25%']
    );
  });

  it('should build the total-tests segments from success/aborted/failed', () => {
    const { result } = renderHook(() => useTestSummaryCards(sampleSummary));

    expect(result.current[0].segments).toEqual([
      {
        id: TestSummarySegmentId.Success,
        name: 'label.success',
        value: 80,
      },
      {
        id: TestSummarySegmentId.Aborted,
        name: 'label.aborted',
        value: 5,
      },
      {
        id: TestSummarySegmentId.Failed,
        name: 'label.failed',
        value: 15,
      },
    ]);
  });

  it('should derive unhealthy and uncovered as the remainder', () => {
    const { result } = renderHook(() => useTestSummaryCards(sampleSummary));
    const [, healthy, coverage] = result.current;

    // totalDQEntities - healthy = 50 - 40
    expect(healthy.segments[1]).toMatchObject({
      id: TestSummarySegmentId.Unhealthy,
      value: 10,
    });
    // totalEntityCount - totalDQEntities = 200 - 50
    expect(coverage.segments[1]).toMatchObject({
      id: TestSummarySegmentId.Uncovered,
      value: 150,
    });
  });

  it('should default every value to zero when testSummary is undefined', () => {
    const { result } = renderHook(() =>
      useTestSummaryCards(undefined as unknown as TestSummary)
    );

    expect(result.current.map((card) => card.value)).toEqual([0, 0, 0]);
    expect(
      result.current.every((card) =>
        card.segments.every((segment) => segment.value === 0)
      )
    ).toBe(true);
    expect(result.current.map((card) => card.percentage)).toEqual([
      '0%',
      '0%',
      '0%',
    ]);
  });
});
