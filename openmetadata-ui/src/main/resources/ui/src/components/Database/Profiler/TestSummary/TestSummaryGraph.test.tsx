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

import type {
  CartesianChartProps,
  ChartReferenceLine,
  ChartSeries,
} from '@openmetadata/ui-core-components/charts';
import { ComposedChart } from '@openmetadata/ui-core-components/charts';
import { useQueries } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  queryByAttribute,
  render,
  screen,
} from '@testing-library/react';
import { omit } from 'lodash';
import { Task } from '../../../../generated/entity/tasks/task';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { getTaskById } from '../../../../rest/tasksAPI';
import { axisTickFormatter } from '../../../../utils/ChartUtils';
import { placedSeriesKey } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import TestSummaryGraph from './TestSummaryGraph';
import { TOOLTIP_CLOSE_DELAY } from './TestSummaryGraph.constants';
import { TestSummaryGraphProps } from './TestSummaryGraph.interface';

type Point = Record<string, unknown>;

const mockProps: TestSummaryGraphProps = {
  testCaseName: 'column_values_to_be_between',
  testCaseParameterValue: [
    {
      name: 'min',
      value: '90001',
    },
    {
      name: 'max',
      value: '96162',
    },
  ],
  testCaseResults: [
    {
      timestamp: 1721036998163,
      testCaseStatus: 'Success',
      result:
        'Found min=90001, max=96612 vs. the expected min=90001, max=96162.',
      testResultValue: [
        {
          name: 'min',
          value: '90001',
        },
        {
          name: 'max',
          value: '96612',
        },
      ],
      maxBound: 96162,
      minBound: 90001,
    },
  ] as TestSummaryGraphProps['testCaseResults'],
  selectedTimeRange: 'Last 30 days',
};

const mockGetTaskById = getTaskById as jest.Mock;
const mockUseQueries = useQueries as jest.Mock;
const mockComposedChart = ComposedChart as unknown as jest.Mock;
const NEWEST_RUN_TIMESTAMP = 1721036998163;
const OLDER_RUN_TIMESTAMP = 1720000000000;
const FORMATTED_DATE = 'Jul 15, 2024, 4:39 PM';
const TOOLTIP_TEST_ID = 'test-summary-tooltip';
const twoRunResults = [
  mockProps.testCaseResults[0],
  { ...mockProps.testCaseResults[0], timestamp: OLDER_RUN_TIMESTAMP },
];
const singleSeriesResults = [
  {
    ...mockProps.testCaseResults[0],
    testResultValue: [{ name: 'value', value: '9990' }],
  },
] as TestSummaryGraphProps['testCaseResults'];
// An aborted run between two measured ones, newest first as the API sends them.
const runsAroundAnAbort = [
  {
    timestamp: 3,
    testCaseStatus: 'Success',
    testResultValue: [{ name: 'value', value: '90' }],
  },
  { timestamp: 2, testCaseStatus: 'Aborted' },
  {
    timestamp: 1,
    testCaseStatus: 'Success',
    testResultValue: [{ name: 'value', value: '120' }],
  },
] as TestSummaryGraphProps['testCaseResults'];
// No parameters and no learned bounds, so only the runs set the y axis.
const noExpectationProps: Partial<TestSummaryGraphProps> = {
  testCaseParameterValue: [],
  testCaseResults: mockProps.testCaseResults.map((result) =>
    omit(result, ['maxBound', 'minBound'])
  ) as TestSummaryGraphProps['testCaseResults'],
};
const PLOT_RECT = { height: 400, width: 800 };
let mockTooltipRect = { height: 160, width: 240 };

const getChartProps = () =>
  mockComposedChart.mock.calls.at(-1)[0] as CartesianChartProps<Point>;

const getSeries = (key: string) =>
  getChartProps().series.find((series) => series.key === key) as ChartSeries;

const getReferenceLine = (axis: ChartReferenceLine['axis']) =>
  getChartProps().referenceLines?.find((line) => line.axis === axis);

type AxisExtent = { min: number; max: number };

const getYAxisBounds = () =>
  getChartProps().yAxis as unknown as {
    min: (extent: AxisExtent) => number;
    max: (extent: AxisExtent) => number;
  };

const hoverPoint = (x: number, y: number) => {
  const props = getChartProps();
  act(() => {
    props.onPointHover?.(props.data[0], 'min', { x, y });
  });
};

const getTooltipPosition = () =>
  screen.getByTestId(TOOLTIP_TEST_ID).parentElement?.parentElement;

// Interpolation values are appended to the key, so a test can tell which
// value a label was given.
const mockT = (key: string, options?: Record<string, unknown>) =>
  options ? [key, ...Object.values(options)].join(' ') : key;

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: mockT }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueries: jest.fn(),
}));

jest.mock('../../../../rest/tasksAPI', () => ({
  getTaskById: jest.fn(),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockReturnValue('Jan 01, 2024'),
  formatDateTimeLong: jest.fn().mockReturnValue('Jul 15, 2024, 4:39 PM'),
  getCurrentMillis: jest.fn().mockReturnValue(1711583974000),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1709424034000),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
  convertSecondsToHumanReadableFormat: jest
    .fn()
    .mockImplementation((val) => `${val}ms`),
}));

jest.mock(
  '../TestSummaryCustomTooltip/TestSummaryCustomTooltip.component',
  () =>
    jest.fn().mockImplementation(({ onMouseEnter, onMouseLeave }) => (
      <>
        <button
          aria-label="tooltip"
          data-testid="test-summary-tooltip"
          type="button"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
        <a data-testid="test-summary-incident-link" href="#incident">
          incident
        </a>
      </>
    ))
);
const mockSetShowAILearningBanner = jest.fn();
const mockSetSelectedRunTimestamp = jest.fn();
let mockSelectedRunTimestamp: number | undefined;
jest.mock('../../../DataQuality/IncidentManager/useTestCase.store', () => ({
  useTestCaseStore: jest.fn().mockImplementation(() => ({
    setShowAILearningBanner: mockSetShowAILearningBanner,
    selectedRunTimestamp: mockSelectedRunTimestamp,
    setSelectedRunTimestamp: mockSetSelectedRunTimestamp,
  })),
}));

describe('TestSummaryGraph', () => {
  let rectSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedRunTimestamp = undefined;
    mockTooltipRect = { height: 160, width: 240 };
    // The plot reports the chart's size, everything else the tooltip's.
    rectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const { height, width } =
          this.id === `${mockProps.testCaseName}_graph`
            ? PLOT_RECT
            : mockTooltipRect;

        return {
          bottom: height,
          height,
          left: 0,
          right: width,
          top: 0,
          width,
          x: 0,
          y: 0,
          toJSON: jest.fn(),
        };
      });
    mockUseQueries.mockReturnValue([]);
  });

  afterEach(() => {
    rectSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should show the placeholder for the selected time range when there are no results', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        selectedTimeRange="Last 7 days"
        testCaseResults={[]}
      />
    );

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(
      screen.getByText('message.no-test-result-for-days Last 7 days')
    ).toBeInTheDocument();
    expect(mockComposedChart).not.toHaveBeenCalled();
  });

  it('should draw the chart when the test result data is present', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(mockComposedChart).toHaveBeenCalled();
    expect(
      queryByAttribute('id', document.body, `${mockProps.testCaseName}_graph`)
    ).toBeInTheDocument();
    expect(getChartProps()).toMatchObject({
      ariaLabel: 'label.test-case-result',
      xKey: 'name',
      tooltip: { show: false },
    });
  });

  it('should show the legend for several series', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(getChartProps().legend).toEqual({ show: true });
  });

  it('should hide the legend for a single series', () => {
    render(
      <TestSummaryGraph {...mockProps} testCaseResults={singleSeriesResults} />
    );

    expect(getChartProps().legend).toEqual({ show: false });
  });

  it('should call mockSetShowAILearningBanner', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(mockSetShowAILearningBanner).toHaveBeenCalledWith(false);
  });

  it('should size the chart from minHeight', () => {
    render(<TestSummaryGraph {...mockProps} minHeight={500} />);

    expect(getChartProps().height).toBe(500);
  });

  it('should default the chart height to 400', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(getChartProps().height).toBe(400);
  });

  it('should plot time on the x axis with long date labels', () => {
    render(<TestSummaryGraph {...mockProps} />);

    const { xAxis } = getChartProps();

    expect(xAxis?.type).toBe('time');
    expect(xAxis?.formatter?.(NEWEST_RUN_TIMESTAMP)).toBe(FORMATTED_DATE);
  });

  it('should format the y axis as a duration for freshness tests', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testDefinitionName="tableDataToBeFresh"
      />
    );

    expect(
      (getChartProps().yAxis as { formatter: (v: number) => string }).formatter(
        3600
      )
    ).toBe('3600ms');
  });

  // The newest run sits at the right edge and the extremes at the top and
  // bottom; without padding their dots and the selection halo are clipped.
  it('should pad the x axis so the edge runs are not clipped', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(getChartProps().xAxis?.boundaryGap).toEqual(['2%', '2%']);
  });

  it('should pad the y axis by a share of the data span', () => {
    render(<TestSummaryGraph {...mockProps} {...noExpectationProps} />);

    const { min, max } = getYAxisBounds();

    expect(min({ min: 100, max: 200 })).toBe(96);
    expect(max({ min: 100, max: 200 })).toBe(204);
  });

  // ECharts drops a reference line outside the axis range, and a failing run
  // can sit far from its expectation: 110 rows against an expected 10,000.
  it.each<[string, string, AxisExtent]>([
    ['above', '10000', { min: 110, max: 120 }],
    ['below', '100', { min: 500, max: 600 }],
  ])(
    'should stretch the y axis to an expectation %s every run',
    (_, expected, extent) => {
      render(
        <TestSummaryGraph
          {...mockProps}
          testCaseParameterValue={[{ name: 'value', value: expected }]}
        />
      );

      const { min, max } = getYAxisBounds();

      expect(min(extent)).toBeLessThan(Number(expected));
      expect(max(extent)).toBeGreaterThan(Number(expected));
    }
  );

  it('should pad a flat series so it is not drawn on the plot edge', () => {
    render(<TestSummaryGraph {...mockProps} {...noExpectationProps} />);

    const { min, max } = getYAxisBounds();

    expect(min({ min: 5, max: 5 })).toBe(4);
    expect(max({ min: 5, max: 5 })).toBe(6);
  });

  it('should format the y axis as a number for other tests', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(
      (getChartProps().yAxis as { formatter: (v: number) => string }).formatter(
        3600
      )
    ).toBe(axisTickFormatter(3600));
  });

  it('should draw the expectation line at the asserted value', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testCaseParameterValue={[
          { name: 'value', value: '10000' },
          { name: 'threshold', value: '5' },
        ]}
      />
    );

    expect(getReferenceLine('y')).toEqual({
      axis: 'y',
      value: 10000,
      label: `label.expected-value ${(10000).toLocaleString()}`,
    });
  });

  it('should fall back to the learned bound when no parameter asserts a number', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testCaseParameterValue={[{ name: 'strategy', value: 'ROWS' }]}
      />
    );

    expect(getReferenceLine('y')).toMatchObject({
      value: 96162,
      label: expect.stringContaining('label.learned-baseline'),
    });
  });

  it('should draw no expectation line when nothing supplies a value', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testCaseParameterValue={[{ name: 'strategy', value: 'ROWS' }]}
        testCaseResults={[
          { ...mockProps.testCaseResults[0], maxBound: undefined },
        ]}
      />
    );

    expect(getReferenceLine('y')).toBeUndefined();
  });

  // The run-details card is a sibling of the chart, so the selection has to
  // leave the chart to reach it.
  it('should guide to the newest run until one is selected', () => {
    render(<TestSummaryGraph {...mockProps} />);

    // No status: the palette's red would read the guide as a failed run.
    expect(getReferenceLine('x')).toEqual({
      axis: 'x',
      value: NEWEST_RUN_TIMESTAMP,
    });
  });

  it('should guide to the selected run once the store holds one', () => {
    mockSelectedRunTimestamp = OLDER_RUN_TIMESTAMP;

    render(<TestSummaryGraph {...mockProps} testCaseResults={twoRunResults} />);

    expect(getReferenceLine('x')?.value).toBe(OLDER_RUN_TIMESTAMP);
  });

  // The store keeps the selection across a date-range or dimension change; a
  // run the refetched data no longer holds must not leave the chart unmarked.
  it('should fall back to the newest run when the selected run is not plotted', () => {
    mockSelectedRunTimestamp = 1700000000000;

    render(<TestSummaryGraph {...mockProps} />);

    expect(getReferenceLine('x')?.value).toBe(NEWEST_RUN_TIMESTAMP);
  });

  // The status key draws aborted as a ring; the chart has to match it.
  it('should draw an aborted run as a hollow warning dot', () => {
    render(<TestSummaryGraph {...mockProps} testCaseResults={twoRunResults} />);

    expect(
      getSeries('min').pointStyle?.(
        {
          name: OLDER_RUN_TIMESTAMP,
          status: TestCaseStatus.Aborted,
          min: 1,
        },
        0
      )
    ).toEqual({ status: 'warning', hollow: true, selected: false });
  });

  // An aborted run has no value: drawn on the line, it read as a measured
  // drop. The line bridges it, and the run keeps a ring of its own.
  it('should keep an aborted run off the line and bridge the line over it', () => {
    render(
      <TestSummaryGraph {...mockProps} testCaseResults={runsAroundAnAbort} />
    );

    const aborted = getChartProps().data.find(
      (point) => point.status === TestCaseStatus.Aborted
    ) as Point;
    const markers = getSeries(placedSeriesKey('value'));

    expect(aborted.value).toBeUndefined();
    expect(getSeries('value').seriesOption).toEqual(
      expect.objectContaining({ connectNulls: true })
    );
    expect(markers.name).toBe('value');
    expect(markers.pointStyle?.(aborted, 1)).toEqual({
      status: 'warning',
      hollow: true,
      selected: false,
    });
  });

  it('should still list an aborted run kept off the line for screen readers', () => {
    render(
      <TestSummaryGraph {...mockProps} testCaseResults={runsAroundAnAbort} />
    );

    expect(screen.getAllByTestId('test-summary-point-value')).toHaveLength(3);
  });

  it('should draw a passing run as a filled success dot', () => {
    render(<TestSummaryGraph {...mockProps} testCaseResults={twoRunResults} />);

    expect(
      getSeries('min').pointStyle?.(
        {
          name: OLDER_RUN_TIMESTAMP,
          status: TestCaseStatus.Success,
          min: 1,
        },
        0
      )
    ).toEqual({ status: 'success', hollow: false, selected: false });
  });

  it('should mark only the active run as selected', () => {
    render(<TestSummaryGraph {...mockProps} testCaseResults={twoRunResults} />);

    const { pointStyle } = getSeries('min');

    expect(
      pointStyle?.(
        { name: NEWEST_RUN_TIMESTAMP, status: TestCaseStatus.Success, min: 1 },
        1
      )?.selected
    ).toBe(true);
    expect(
      pointStyle?.(
        { name: OLDER_RUN_TIMESTAMP, status: TestCaseStatus.Success, min: 1 },
        0
      )?.selected
    ).toBe(false);
  });

  it('should move the selected halo to the run the store holds', () => {
    mockSelectedRunTimestamp = OLDER_RUN_TIMESTAMP;
    render(<TestSummaryGraph {...mockProps} testCaseResults={twoRunResults} />);

    const { pointStyle } = getSeries('min');

    expect(
      pointStyle?.(
        { name: OLDER_RUN_TIMESTAMP, status: TestCaseStatus.Success, min: 1 },
        0
      )?.selected
    ).toBe(true);
    expect(
      pointStyle?.(
        { name: NEWEST_RUN_TIMESTAMP, status: TestCaseStatus.Success, min: 1 },
        1
      )?.selected
    ).toBe(false);
  });

  it('should draw no dot where the series holds no value', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(
      getSeries('min').pointStyle?.(
        { name: NEWEST_RUN_TIMESTAMP, status: TestCaseStatus.Success },
        0
      )
    ).toBeUndefined();
  });

  // Neutral is a track colour, too pale to read as a data line.
  it('should draw a single series as a muted area', () => {
    render(
      <TestSummaryGraph {...mockProps} testCaseResults={singleSeriesResults} />
    );

    expect(getSeries('value')).toMatchObject({
      type: 'area',
      status: 'muted',
      smooth: false,
    });
  });

  // Focusing a hovered series fades every other one, the allowed-range band
  // and the expectation label included; with one series that only hides them.
  it('should not fade the band and expectation line when a single series is hovered', () => {
    render(
      <TestSummaryGraph {...mockProps} testCaseResults={singleSeriesResults} />
    );

    expect(getSeries('value').seriesOption).not.toHaveProperty('emphasis');
  });

  it('should bring the hovered series forward when there are several', () => {
    render(<TestSummaryGraph {...mockProps} />);

    ['min', 'max'].forEach((key) => {
      expect(getSeries(key).seriesOption).toEqual(
        expect.objectContaining({ emphasis: { focus: 'series' } })
      );
    });
  });

  it('should draw several series as palette lines', () => {
    render(<TestSummaryGraph {...mockProps} />);

    ['min', 'max'].forEach((key) => {
      expect(getSeries(key)).toMatchObject({ type: 'line', smooth: false });
      expect(getSeries(key).status).toBeUndefined();
    });
  });

  it('should draw the allowed range as a band when a run carries bounds', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(getChartProps().series[0]).toEqual({
      key: 'boundArea',
      name: 'label.range',
      type: 'band',
      status: 'success',
    });
  });

  it('should draw no band when no run carries bounds', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testCaseParameterValue={[]}
        testCaseResults={[
          {
            ...mockProps.testCaseResults[0],
            maxBound: undefined,
            minBound: undefined,
          },
        ]}
      />
    );

    expect(
      getChartProps().series.some((series) => series.type === 'band')
    ).toBe(false);
  });

  it('should open the tooltip beside the hovered point', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.queryByTestId(TOOLTIP_TEST_ID)).not.toBeInTheDocument();

    hoverPoint(10, 20);

    expect(screen.getByTestId(TOOLTIP_TEST_ID)).toBeInTheDocument();
    expect(getTooltipPosition()).toHaveStyle({
      transform: 'translate(14px, 24px)',
    });
  });

  it('should close the tooltip once the close delay has passed', () => {
    jest.useFakeTimers();
    render(<TestSummaryGraph {...mockProps} />);

    hoverPoint(10, 20);
    act(() => getChartProps().onPointLeave?.());
    act(() => {
      jest.advanceTimersByTime(TOOLTIP_CLOSE_DELAY - 1);
    });

    expect(screen.getByTestId(TOOLTIP_TEST_ID)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId(TOOLTIP_TEST_ID)).not.toBeInTheDocument();
  });

  // The incident link lives in the tooltip, so the pointer must be able to
  // cross from the point into it.
  it('should keep the tooltip open while the pointer is over it', () => {
    jest.useFakeTimers();
    render(<TestSummaryGraph {...mockProps} />);

    hoverPoint(10, 20);
    act(() => getChartProps().onPointLeave?.());
    fireEvent.mouseEnter(screen.getByTestId(TOOLTIP_TEST_ID));
    act(() => {
      jest.advanceTimersByTime(TOOLTIP_CLOSE_DELAY);
    });

    expect(screen.getByTestId(TOOLTIP_TEST_ID)).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId(TOOLTIP_TEST_ID));
    act(() => {
      jest.advanceTimersByTime(TOOLTIP_CLOSE_DELAY);
    });

    expect(screen.queryByTestId(TOOLTIP_TEST_ID)).not.toBeInTheDocument();
  });

  // Tab from the chart lands on the incident link; the chart's blur must not
  // close the tooltip from under the focus.
  it('should keep the tooltip open while focus is inside it', () => {
    jest.useFakeTimers();
    render(<TestSummaryGraph {...mockProps} />);

    hoverPoint(10, 20);
    act(() => getChartProps().onPointLeave?.());
    act(() => screen.getByTestId('test-summary-incident-link').focus());
    act(() => screen.getByTestId(TOOLTIP_TEST_ID).focus());
    act(() => {
      jest.advanceTimersByTime(TOOLTIP_CLOSE_DELAY);
    });

    expect(screen.getByTestId(TOOLTIP_TEST_ID)).toBeInTheDocument();

    act(() => screen.getByTestId(TOOLTIP_TEST_ID).blur());
    act(() => {
      jest.advanceTimersByTime(TOOLTIP_CLOSE_DELAY);
    });

    expect(screen.queryByTestId(TOOLTIP_TEST_ID)).not.toBeInTheDocument();
  });

  it('should flip the tooltip when the chart edges would overflow', () => {
    render(<TestSummaryGraph {...mockProps} />);

    hoverPoint(760, 360);

    expect(getTooltipPosition()).toHaveStyle({
      transform: 'translate(516px, 196px)',
    });
  });

  it('should keep the seeded tooltip position when its content has no size', () => {
    mockTooltipRect = { height: 0, width: 0 };
    render(<TestSummaryGraph {...mockProps} />);

    hoverPoint(760, 360);

    expect(screen.getByTestId(TOOLTIP_TEST_ID)).toBeInTheDocument();
    expect(getTooltipPosition()).toHaveStyle({
      transform: 'translate(764px, 364px)',
    });
  });

  it('should publish the clicked run to the store', () => {
    render(<TestSummaryGraph {...mockProps} testCaseResults={twoRunResults} />);

    const props = getChartProps();
    act(() => props.onPointClick?.(props.data[0], 'min'));

    expect(mockSetSelectedRunTimestamp).toHaveBeenCalledWith(
      OLDER_RUN_TIMESTAMP
    );
  });

  it('should make the points reachable from the keyboard', () => {
    render(<TestSummaryGraph {...mockProps} />);

    const props = getChartProps();

    expect(props.keyboardNavigation).toBe(true);
    expect(
      props.pointAriaLabel?.(
        { name: NEWEST_RUN_TIMESTAMP, status: TestCaseStatus.Aborted },
        'min'
      )
    ).toBe(`${FORMATTED_DATE}: Aborted`);
  });

  // The hidden run list is the chart's text alternative and its e2e hook.
  it('should list one entry per plotted run with its status', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testCaseResults={[
          singleSeriesResults[0],
          {
            ...singleSeriesResults[0],
            testCaseStatus: TestCaseStatus.Failed,
            timestamp: OLDER_RUN_TIMESTAMP,
          },
        ]}
      />
    );

    const entries = screen.getAllByTestId('test-summary-point-value');

    expect(screen.getByTestId('test-summary-runs')).toHaveClass('tw:sr-only');
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.dataset.status)).toEqual([
      TestCaseStatus.Failed,
      TestCaseStatus.Success,
    ]);
    expect(entries[0]).toHaveTextContent(`${FORMATTED_DATE}: Failed`);
  });

  it('should list a run once for every series it has a value on', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.getAllByTestId('test-summary-point-min')).toHaveLength(1);
    expect(screen.getAllByTestId('test-summary-point-max')).toHaveLength(1);
  });

  it('should list runs that share a timestamp without a key collision', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    render(
      <TestSummaryGraph
        {...mockProps}
        testCaseResults={[
          mockProps.testCaseResults[0],
          mockProps.testCaseResults[0],
        ]}
      />
    );

    expect(screen.getAllByTestId('test-summary-point-min')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('should handle empty testCaseParameterValue', () => {
    render(
      <TestSummaryGraph {...mockProps} testCaseParameterValue={undefined} />
    );

    expect(
      queryByAttribute('id', document.body, `${mockProps.testCaseName}_graph`)
    ).toBeInTheDocument();
  });

  it('should keep successful tasks and key queries by unique incident IDs', async () => {
    const incidentTask = {
      id: 'incident-id',
      taskId: 'TASK-00001',
    } as Task;
    const secondIncidentTask = {
      id: 'second-incident-id',
      taskId: 'TASK-00002',
    } as Task;
    const incidentProps = {
      ...mockProps,
      testCaseResults: [
        {
          ...mockProps.testCaseResults[0],
          incidentId: incidentTask.id,
        },
        {
          ...mockProps.testCaseResults[0],
          incidentId: secondIncidentTask.id,
        },
        {
          ...mockProps.testCaseResults[0],
          incidentId: incidentTask.id,
        },
      ],
    };
    mockGetTaskById
      .mockResolvedValueOnce({ data: incidentTask })
      .mockRejectedValueOnce(new Error('Task unavailable'));

    render(<TestSummaryGraph {...incidentProps} />);

    const { combine, queries } = mockUseQueries.mock.calls.at(-1)[0];

    expect(queries).toEqual([
      expect.objectContaining({
        queryKey: ['test-summary', 'incident-task', incidentTask.id],
      }),
      expect.objectContaining({
        queryKey: ['test-summary', 'incident-task', secondIncidentTask.id],
      }),
    ]);
    await expect(queries[0].queryFn()).resolves.toEqual(incidentTask);
    await expect(queries[1].queryFn()).rejects.toThrow('Task unavailable');
    expect(combine([{ data: incidentTask }, { data: undefined }])).toEqual([
      incidentTask,
    ]);
    expect(mockGetTaskById).toHaveBeenCalledTimes(2);
    expect(mockGetTaskById).toHaveBeenCalledWith(incidentTask.id, {
      fields: 'about,assignees',
    });
    expect(mockGetTaskById).toHaveBeenCalledWith(secondIncidentTask.id, {
      fields: 'about,assignees',
    });
  });
});
