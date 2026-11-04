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
import { App, AppType } from '../../../../generated/entity/applications/app';
import { useAppScheduleOptions } from './useAppScheduleOptions';

let mockLimitsConfig: unknown;

jest.mock('../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ config: mockLimitsConfig }),
}));

const withAppSchedules = (pipelineSchedules: string[]) => ({
  limits: {
    config: {
      featureLimits: [
        { name: 'pipeline', pipelineSchedules: ['hourly'] },
        { name: 'app', pipelineSchedules },
      ],
    },
  },
});

const internalApp = {
  name: 'SearchIndexingApplication',
  appType: AppType.Internal,
} as App;

describe('useAppScheduleOptions', () => {
  beforeEach(() => {
    mockLimitsConfig = undefined;
  });

  it('offers every schedule and a daily default when no plan limits are set', () => {
    const { result } = renderHook(() => useAppScheduleOptions(internalApp));

    expect(result.current).toEqual({
      initialOptions: undefined,
      defaultCron: '0 0 * * *',
    });
  });

  it("limits the options to the plan's app schedules", () => {
    mockLimitsConfig = withAppSchedules(['daily', 'weekly']);

    const { result } = renderHook(() => useAppScheduleOptions(internalApp));

    expect(result.current.initialOptions).toEqual(['day', 'week']);
  });

  it('only offers a daily schedule for external apps', () => {
    mockLimitsConfig = withAppSchedules(['hourly', 'daily']);

    const { result } = renderHook(() =>
      useAppScheduleOptions({ ...internalApp, appType: AppType.External })
    );

    expect(result.current.initialOptions).toEqual(['day']);
  });

  it('defaults the Data Insights report to a weekly Sunday schedule', () => {
    const { result } = renderHook(() =>
      useAppScheduleOptions({
        ...internalApp,
        name: 'DataInsightsReportApplication',
      })
    );

    expect(result.current).toEqual({
      initialOptions: ['week'],
      defaultCron: '0 0 * * 0',
    });
  });

  it('keeps the same options object across re-renders of the same app', () => {
    const { result, rerender } = renderHook(() =>
      useAppScheduleOptions(internalApp)
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
