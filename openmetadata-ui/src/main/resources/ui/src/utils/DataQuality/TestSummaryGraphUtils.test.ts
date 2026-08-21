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
import { GREEN_3, RED_3, YELLOW_2 } from '../../constants/Color.constants';
import { Task } from '../../generated/entity/tasks/task';
import { TestCaseStatus } from '../../generated/tests/testCase';
import {
  formatTestSummaryYAxis,
  getStatusDotColor,
  getTestSummaryTooltipPosition,
  isSameTooltipPosition,
  prepareChartData,
  PrepareChartDataType,
} from './TestSummaryGraphUtils';

jest.mock('../../constants/profiler.constant', () => {
  return {
    COLORS: ['#7147E8', '#B02AAC', '#B02AAC', '#1890FF', '#008376'],
  };
});

jest.mock('../../utils/DataInsightUtils', () => {
  return {
    getRandomHexColor: jest.fn().mockReturnValue('#7147E8'),
  };
});

jest.mock('../ChartUtils', () => ({
  axisTickFormatter: jest.fn((value: number) => {
    if (value >= 1_000_000) {
      return `${value / 1_000_000}M`;
    }

    if (value >= 1_000) {
      return `${value / 1_000}k`;
    }

    return String(value);
  }),
}));

describe('prepareChartData', () => {
  it('should resolve incident metadata from tasks', () => {
    const incidentId = '3093dbee-196b-4284-9f97-7103063d0dd7';
    const task = {
      id: incidentId,
      taskId: 'TASK-00244',
    } as Task;

    const result = prepareChartData({
      tasks: [task],
      testCaseParameterValue: [],
      testCaseResults: [
        {
          incidentId,
          testCaseStatus: TestCaseStatus.Failed,
          timestamp: 1720525804736,
        },
      ],
    });

    expect(result.data[0].task).toEqual(task);
  });

  it('should not attach an incident to results that have no incidentId', () => {
    const result = prepareChartData({
      tasks: [{ id: 'd0a1c3e2-6b64-4f2e-9a1a-3d0a5f8b7c22' } as Task],
      testCaseParameterValue: [],
      testCaseResults: [
        {
          testCaseStatus: TestCaseStatus.Success,
          timestamp: 1720525804736,
        },
      ],
    });

    expect(result.data[0].task).toBeUndefined();
  });

  it('should prepare chart data correctly', () => {
    const testObj = {
      testCaseParameterValue: [
        {
          name: 'minValueForMaxInCol',
          value: '1720165283528',
        },
        {
          name: 'maxValueForMaxInCol',
          value: '1720275283528',
        },
      ],
      testCaseResults: [
        {
          timestamp: 1720525804736,
          testCaseStatus: 'Failed',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [
            {
              name: 'max',
              value: '1720520076998',
            },
          ],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          maxBound: 1720275283528,
          minBound: 1720165283528,
        },
        {
          timestamp: 1720525503943,
          testCaseStatus: 'Failed',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [
            {
              name: 'max',
              value: '1720520076998',
            },
          ],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          maxBound: 1720275283528,
          minBound: 1720165283528,
        },
      ],
      tasks: [],
    } as PrepareChartDataType;

    const result = prepareChartData(testObj);

    expect(result).toEqual({
      data: [
        {
          boundArea: [1720165283528, 1720275283528],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          max: 1720520076998,
          name: 1720525503943,
          status: 'Failed',
          task: undefined,
        },
        {
          boundArea: [1720165283528, 1720275283528],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          max: 1720520076998,
          name: 1720525804736,
          status: 'Failed',
          task: undefined,
        },
      ],
      information: [
        {
          color: '#7147E8',
          label: 'max',
        },
      ],
      showAILearningBanner: false,
    });
  });

  it('should handle min/max bound correctly', () => {
    const testObj = {
      testCaseParameterValue: [],
      testCaseResults: [
        {
          timestamp: 1720525804736,
          testCaseStatus: 'Failed',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [
            {
              name: 'max',
              value: '1720520076998',
            },
          ],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          maxBound: 1720275283528,
        },
        {
          timestamp: 1720525503943,
          testCaseStatus: 'Failed',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [
            {
              name: 'max',
              value: '1720520076998',
            },
          ],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          minBound: 1720165283528,
        },
        {
          timestamp: 1720525503943,
          testCaseStatus: 'Failed',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [
            {
              name: 'max',
              value: '1720520076998',
            },
          ],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          maxBound: 1720275283528,
          minBound: 1720165283528,
        },
      ],
      tasks: [],
    } as PrepareChartDataType;

    const result = prepareChartData(testObj);

    expect(result).toEqual({
      data: [
        {
          boundArea: [1720165283528, 1720275283528],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          max: 1720520076998,
          name: 1720525503943,
          status: 'Failed',
          task: undefined,
        },
        {
          boundArea: undefined,
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          max: 1720520076998,
          name: 1720525503943,
          status: 'Failed',
          task: undefined,
        },
        {
          boundArea: undefined,
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          max: 1720520076998,
          name: 1720525804736,
          status: 'Failed',
          task: undefined,
        },
      ],
      information: [
        {
          color: '#7147E8',
          label: 'max',
        },
      ],
      showAILearningBanner: true,
    });
  });

  it('should handle empty testCaseParameterValue correctly', () => {
    const testObj = {
      testCaseParameterValue: [],
      testCaseResults: [
        {
          timestamp: 1720525804736,
          testCaseStatus: 'Failed',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [
            {
              name: 'max',
              value: '1720520076998',
            },
          ],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          maxBound: 1720275283528,
          minBound: 1720165283528,
        },
      ],
      tasks: [],
    } as PrepareChartDataType;

    const result = prepareChartData(testObj);

    expect(result).toEqual({
      data: [
        {
          boundArea: [1720165283528, 1720275283528],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          max: 1720520076998,
          name: 1720525804736,
          status: 'Failed',
          task: undefined,
        },
      ],
      information: [
        {
          color: '#7147E8',
          label: 'max',
        },
      ],
      showAILearningBanner: false,
    });
  });

  it('should handle empty testCaseResults correctly', () => {
    const testObj = {
      testCaseParameterValue: [
        {
          name: 'minValueForMaxInCol',
          value: '1720165283528',
        },
        {
          name: 'maxValueForMaxInCol',
          value: '1720275283528',
        },
      ],
      testCaseResults: [],
      tasks: [],
    } as PrepareChartDataType;

    const result = prepareChartData(testObj);

    expect(result).toEqual({
      data: [],
      information: [],
      showAILearningBanner: false,
    });
  });

  it('should handle string value in testCaseParams correctly', () => {
    const testObj = {
      testCaseParameterValue: [
        {
          name: 'minValueForMaxInCol',
          value: 'Sales',
        },
        {
          name: 'maxValueForMaxInCol',
          value: '1720275283528',
        },
      ],
      testCaseResults: [
        {
          timestamp: 1720525804736,
          testCaseStatus: 'Failed',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [
            {
              name: 'max',
              value: '1720520076998',
            },
          ],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
        },
      ],
      tasks: [],
    } as PrepareChartDataType;

    const result = prepareChartData(testObj);

    expect(result).toEqual({
      data: [
        {
          boundArea: undefined,
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          max: 1720520076998,
          name: 1720525804736,
          status: 'Failed',
          task: undefined,
        },
      ],
      information: [
        {
          color: '#7147E8',
          label: 'max',
        },
      ],
      showAILearningBanner: true,
    });
  });

  it('should show calculate test case result params accurately', () => {
    const testObj = {
      testCaseParameterValue: [],
      testCaseResults: [
        {
          timestamp: 1720525804736,
          testCaseStatus: 'Aborted',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
        },
        {
          timestamp: 1720525503943,
          testCaseStatus: 'Failed',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [
            {
              name: 'max',
              value: '1720520076998',
            },
          ],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          minBound: 1720165283528,
        },
      ],
      tasks: [],
    } as PrepareChartDataType;

    const result = prepareChartData(testObj);

    expect(result).toEqual({
      data: [
        {
          boundArea: undefined,
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          max: 1720520076998,
          name: 1720525503943,
          status: 'Failed',
          task: undefined,
        },
        {
          boundArea: undefined,
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          name: 1720525804736,
          status: 'Aborted',
          task: undefined,
        },
      ],
      information: [
        {
          color: '#7147E8',
          label: 'max',
        },
      ],
      showAILearningBanner: true,
    });
  });

  it('should not calculate params for aborted test', () => {
    const testObj = {
      testCaseParameterValue: [],
      testCaseResults: [
        {
          timestamp: 1720525804736,
          testCaseStatus: 'Aborted',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
        },
        {
          timestamp: 1720525503943,
          testCaseStatus: 'Aborted',
          result:
            'Found max=1720520076998 vs.  the expected min=1720165283528.0, max=1720275283528.0.',
          testResultValue: [],
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
        },
      ],
      tasks: [],
    } as PrepareChartDataType;

    const result = prepareChartData(testObj);

    expect(result).toEqual({
      data: [
        {
          boundArea: undefined,
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          name: 1720525503943,
          status: 'Aborted',
          task: undefined,
        },
        {
          boundArea: undefined,
          incidentId: '3093dbee-196b-4284-9f97-7103063d0dd7',
          name: 1720525804736,
          status: 'Aborted',
          task: undefined,
        },
      ],
      information: [],
      showAILearningBanner: true,
    });
  });
});

describe('getStatusDotColor', () => {
  it('should return GREEN_3 for Success', () => {
    expect(getStatusDotColor(TestCaseStatus.Success)).toBe(GREEN_3);
  });

  it('should return RED_3 for Failed', () => {
    expect(getStatusDotColor(TestCaseStatus.Failed)).toBe(RED_3);
  });

  it('should return YELLOW_2 for non success/failure status', () => {
    expect(getStatusDotColor(TestCaseStatus.Aborted)).toBe(YELLOW_2);
  });
});

describe('formatTestSummaryYAxis', () => {
  it('should use freshness format when useFreshnessFormat is true', () => {
    expect(formatTestSummaryYAxis(0, true)).toBe('0s');
    expect(formatTestSummaryYAxis(90, true)).toBe('1m 30s');
    expect(formatTestSummaryYAxis(3600, true)).toBe('1h');
  });

  it('should use axis tick format when useFreshnessFormat is false', () => {
    expect(formatTestSummaryYAxis(1000, false)).toBe('1k');
    expect(formatTestSummaryYAxis(1_000_000, false)).toBe('1M');
  });
});

describe('getTestSummaryTooltipPosition', () => {
  const boundary = { height: 300, width: 800, x: 80, y: 16 };
  const tooltipSize = { height: 160, width: 240 };

  it('should keep the preferred bottom-right placement when it fits', () => {
    expect(
      getTestSummaryTooltipPosition({
        anchor: { x: 200, y: 80 },
        boundary,
        gap: 4,
        tooltipSize,
      })
    ).toEqual({ x: 204, y: 84 });
  });

  it('should flip above when the tooltip would overflow the bottom', () => {
    expect(
      getTestSummaryTooltipPosition({
        anchor: { x: 200, y: 280 },
        boundary,
        gap: 4,
        tooltipSize,
      })
    ).toEqual({ x: 204, y: 116 });
  });

  it('should flip left when the tooltip would overflow the right edge', () => {
    expect(
      getTestSummaryTooltipPosition({
        anchor: { x: 850, y: 80 },
        boundary,
        gap: 4,
        tooltipSize,
      })
    ).toEqual({ x: 606, y: 84 });
  });

  it('should flip both axes at the bottom-right corner', () => {
    expect(
      getTestSummaryTooltipPosition({
        anchor: { x: 850, y: 280 },
        boundary,
        gap: 4,
        tooltipSize,
      })
    ).toEqual({ x: 606, y: 116 });
  });

  it('should clamp oversized tooltips to the boundary origin', () => {
    expect(
      getTestSummaryTooltipPosition({
        anchor: { x: 400, y: 150 },
        boundary,
        gap: 4,
        tooltipSize: { height: 400, width: 900 },
      })
    ).toEqual({ x: 80, y: 16 });
  });
});

describe('isSameTooltipPosition', () => {
  it('should treat sub-pixel measurement noise as the same position', () => {
    expect(
      isSameTooltipPosition({ x: 516, y: 196 }, { x: 516.25, y: 195.75 })
    ).toBe(true);
  });

  it('should treat a visible shift as a new position', () => {
    expect(isSameTooltipPosition({ x: 516, y: 196 }, { x: 520, y: 196 })).toBe(
      false
    );
    expect(isSameTooltipPosition({ x: 516, y: 196 }, { x: 516, y: 204 })).toBe(
      false
    );
  });

  it('should treat an identical position as the same position', () => {
    expect(isSameTooltipPosition({ x: 516, y: 196 }, { x: 516, y: 196 })).toBe(
      true
    );
  });
});
