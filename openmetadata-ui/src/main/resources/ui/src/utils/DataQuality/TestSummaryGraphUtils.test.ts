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
import {
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

describe('prepareChartData', () => {
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
      entityThread: [],
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
      entityThread: [],
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
      entityThread: [],
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
      entityThread: [],
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
      entityThread: [],
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
      entityThread: [],
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
      entityThread: [],
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
