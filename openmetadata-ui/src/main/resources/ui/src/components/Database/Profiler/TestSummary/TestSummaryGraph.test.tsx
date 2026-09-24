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

import { useQueries } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  queryByAttribute,
  render,
  screen,
} from '@testing-library/react';
import { cloneElement } from 'react';
import { Payload } from 'recharts/types/component/DefaultLegendContent';
import { Task } from '../../../../generated/entity/tasks/task';
import { getTaskById } from '../../../../rest/tasksAPI';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { Line } from 'recharts';
import TestSummaryGraph from './TestSummaryGraph';
import { DOT_OUTLINE } from './TestSummaryGraph.constants';
import { TestSummaryGraphProps } from './TestSummaryGraph.interface';

jest.mock('../../../../hooks/useChartColors', () => ({
  useChartColors: jest.fn().mockReturnValue({ grid: '#234567' }),
}));

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

const mockUseActivityFeedProvider = useActivityFeedProvider as jest.Mock;
const mockGetTaskById = getTaskById as jest.Mock;
const mockUseQueries = useQueries as jest.Mock;
const ACTIVE_ATTRIBUTE = 'data-active';
const ACTIVE_VALUE = 'true';
const INACTIVE_VALUE = 'false';
const TOOLTIP_CONTENT_TEST_ID = 'test-summary-custom-tooltip';
const TOOLTIP_TRANSFORM_ATTRIBUTE = 'data-transform';
const TOOLTIP_X_ATTRIBUTE = 'data-x';
const TOOLTIP_Y_ATTRIBUTE = 'data-y';
const POINT_TEST_ID = 'test-summary-point-min';
const TOOLTIP_TEST_ID = 'recharts-tooltip';
let mockPointCoordinate = { x: 320, y: 120 };

jest.mock('@tanstack/react-query', () => ({
  useQueries: jest.fn(),
}));

jest.mock('../../../../rest/tasksAPI', () => ({
  getTaskById: jest.fn(),
}));

// The Line mock renders one dot per series from a fixed payload; this is the
// status that payload carries, so a test can render a run of any status.
let mockDotStatus = 'Success';

jest.mock('recharts', () => ({
  Area: jest
    .fn()
    .mockImplementation((props) => (
      <div data-testid={props['data-testid'] ?? 'area'} />
    )),
  CartesianGrid: jest
    .fn()
    .mockImplementation(() => <div data-testid="cartesian-grid" />),
  ComposedChart: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="composed-chart">{children}</div>
    )),
  Legend: jest.fn().mockImplementation(({ payload, onClick }) => (
    <div data-testid="rechart-legend">
      {payload.map((data: Payload) => (
        <button
          data-testid={data?.value}
          key={data?.value}
          onClick={() => onClick(data)}>
          {data?.value}
        </button>
      ))}
    </div>
  )),
  Line: jest.fn().mockImplementation((props) => {
    const { dataKey, dot, hide } = props;

    return hide ? (
      <></>
    ) : (
      <div
        data-active-dot={String(props.activeDot)}
        data-testid={`line-${dataKey}`}>
        <svg>
          {dot({
            cx: mockPointCoordinate.x,
            cy: mockPointCoordinate.y,
            dataKey,
            payload: {
              max: 96612,
              min: 90001,
              name: 1721036998163,
              status: mockDotStatus,
            },
          })}
        </svg>
      </div>
    );
  }),
  ReferenceLine: jest.fn().mockImplementation(({ label, x, y, ...rest }) => (
    <div
      data-testid={rest['data-testid'] ?? 'reference-line'}
      data-x={x}
      data-y={y}>
      {label?.value}
    </div>
  )),
  ResponsiveContainer: jest
    .fn()
    .mockImplementation(({ children, className, id }) => (
      <div className={className} id={id}>
        {children}
      </div>
    )),
  Tooltip: jest
    .fn()
    .mockImplementation(
      ({ active, content, isAnimationActive, position, wrapperStyle }) => (
        <div
          data-active={String(Boolean(active))}
          data-animation-active={String(isAnimationActive)}
          data-testid="recharts-tooltip"
          data-transform={wrapperStyle?.transform}
          data-visibility={wrapperStyle?.visibility}
          data-x={position?.x ?? 640}
          data-y={position?.y ?? 240}>
          {active
            ? cloneElement(content, {
                viewBox: { height: 400, width: 800, x: 0, y: 0 },
              })
            : null}
        </div>
      )
    ),
  XAxis: jest.fn().mockImplementation(() => <div data-testid="x-axis" />),
  YAxis: jest.fn().mockImplementation(() => <div data-testid="y-axis" />),
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
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn(),
  })
);
jest.mock(
  '../TestSummaryCustomTooltip/TestSummaryCustomTooltip.component',
  () =>
    jest
      .fn()
      .mockImplementation(({ onMouseEnter, onMouseLeave }) => (
        <button
          aria-label="tooltip"
          data-testid="test-summary-custom-tooltip"
          type="button"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      ))
);
const mockSetShowAILearningBanner = jest.fn();
const mockSetSelectedRunTimestamp = jest.fn();
let mockSelectedRunTimestamp: number | undefined;
jest.mock(
  '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store',
  () => ({
    useTestCaseStore: jest.fn().mockImplementation(() => ({
      setShowAILearningBanner: mockSetShowAILearningBanner,
      selectedRunTimestamp: mockSelectedRunTimestamp,
      setSelectedRunTimestamp: mockSetSelectedRunTimestamp,
    })),
  })
);

describe('TestSummaryGraph', () => {
  beforeEach(() => {
    mockSelectedRunTimestamp = undefined;
    mockDotStatus = 'Success';
    mockPointCoordinate = { x: 320, y: 120 };
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 160,
      left: 0,
      right: 240,
      top: 120,
      width: 240,
      x: 0,
      y: 120,
      toJSON: jest.fn(),
    });
    mockUseActivityFeedProvider.mockReturnValue({
      entityThread: [],
    });
    mockUseQueries.mockReturnValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should display error placeholder when the result data is empty', () => {
    render(<TestSummaryGraph {...mockProps} testCaseResults={[]} />);

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
  });

  it('should display the graph when the test result data is present', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(
      queryByAttribute('id', document.body, `${mockProps.testCaseName}_graph`)
    ).toBeInTheDocument();
  });

  it('should render the legend with the correct data', async () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.getByTestId('rechart-legend')).toBeInTheDocument();
    expect(screen.getByTestId('min')).toBeInTheDocument();
    expect(screen.getByTestId('max')).toBeInTheDocument();
  });

  it("legend filter should update the graph's activeKeys", async () => {
    render(<TestSummaryGraph {...mockProps} />);
    const minButton = screen.getByTestId('min');
    const minLineChart = screen.getByTestId('line-min');
    const maxLineChart = screen.getByTestId('line-max');

    expect(minButton).toBeInTheDocument();
    expect(minLineChart).toBeInTheDocument();
    expect(maxLineChart).toBeInTheDocument();

    await act(async () => {
      await fireEvent.click(minButton);
    });

    expect(minLineChart).toBeInTheDocument();
    expect(maxLineChart).not.toBeInTheDocument();
  });

  it('should call mockSetShowAILearningBanner', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(mockSetShowAILearningBanner).toHaveBeenCalledWith(false);
  });

  it('should display selectedTimeRange in error message when no results', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        selectedTimeRange="Last 7 days"
        testCaseResults={[]}
      />
    );

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
  });

  it('should render with minHeight prop', () => {
    render(<TestSummaryGraph {...mockProps} minHeight={500} />);

    expect(
      queryByAttribute('id', document.body, `${mockProps.testCaseName}_graph`)
    ).toBeInTheDocument();
  });

  it('should handle testDefinitionName for freshness tests', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testDefinitionName="tableDataToBeFresh"
      />
    );

    expect(
      queryByAttribute('id', document.body, `${mockProps.testCaseName}_graph`)
    ).toBeInTheDocument();
  });

  it('should handle mouse enter and leave on legend', async () => {
    render(<TestSummaryGraph {...mockProps} />);
    const minButton = screen.getByTestId('min');

    await act(async () => {
      fireEvent.mouseEnter(minButton);
    });

    expect(minButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.mouseLeave(minButton);
    });

    expect(minButton).toBeInTheDocument();
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

    expect(screen.getByTestId('reference-line')).toHaveAttribute(
      'data-y',
      '10000'
    );
    expect(screen.getByTestId('expectation-label')).toHaveAttribute(
      'data-y',
      '10000'
    );
    expect(screen.getByTestId('expectation-label')).toHaveTextContent(
      'label.expected-value'
    );
  });

  // Recharts paints in child order: a label drawn before the series would sit
  // under every run near the expected value.
  it('should draw the expectation label after the series', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testCaseParameterValue={[{ name: 'value', value: '10000' }]}
      />
    );

    const label = screen.getByTestId('expectation-label');
    const series = screen.getByTestId('line-min');

    expect(
      series.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('should fall back to the learned bound when no parameter asserts a number', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testCaseParameterValue={[{ name: 'strategy', value: 'ROWS' }]}
      />
    );

    expect(screen.getByTestId('reference-line')).toHaveAttribute(
      'data-y',
      '96162'
    );
    expect(screen.getByTestId('expectation-label')).toHaveTextContent(
      'label.learned-baseline'
    );
  });

  // A line at no value is the bug this replaced: recharts silently drops it.
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

    expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expectation-label')).not.toBeInTheDocument();
  });

  // The run-details card is a sibling of the chart, so the selection has to
  // leave the chart to reach it.
  it('should guide to the newest run until one is selected', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.getByTestId('run-selection-guide')).toHaveAttribute(
      'data-x',
      String(mockProps.testCaseResults[0].timestamp)
    );
  });

  it('should guide to the selected run once the store holds one', () => {
    mockSelectedRunTimestamp = 1700000000000;

    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.getByTestId('run-selection-guide')).toHaveAttribute(
      'data-x',
      '1700000000000'
    );
  });

  // The status key draws aborted as a ring; the chart has to match it or the
  // key describes a dot that is not on the plot.
  it('should draw an aborted run as a ring', () => {
    mockDotStatus = TestCaseStatus.Aborted;

    render(<TestSummaryGraph {...mockProps} />);

    const [abortedPoint] = screen.getAllByTestId(POINT_TEST_ID);

    expect(abortedPoint).toHaveAttribute('fill', 'none');
    expect(abortedPoint).toHaveAttribute('stroke');
    expect(abortedPoint).toHaveAttribute('pointer-events', 'all');
  });

  it('should keep a passing run filled, outlined in the surface colour', () => {
    render(<TestSummaryGraph {...mockProps} />);

    const [passingPoint] = screen.getAllByTestId(POINT_TEST_ID);

    expect(passingPoint).not.toHaveAttribute('fill', 'none');
    expect(passingPoint).toHaveAttribute('stroke', DOT_OUTLINE);
  });

  it('should mark only the selected run with a halo', () => {
    mockSelectedRunTimestamp = 1721036998163;

    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.getAllByTestId('selected-point-halo').length).toBeGreaterThan(
      0
    );
  });

  it('should draw no halo when another run is selected', () => {
    mockSelectedRunTimestamp = 1;

    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.queryByTestId('selected-point-halo')).not.toBeInTheDocument();
  });

  // The wash is an area under the series, so it follows each run rather than
  // filling a fixed band.
  it('should shade the area under a single series', () => {
    render(
      <TestSummaryGraph
        {...mockProps}
        testCaseResults={[
          {
            ...mockProps.testCaseResults[0],
            testResultValue: [{ name: 'value', value: '9990' }],
          },
        ]}
      />
    );

    expect(screen.getByTestId('series-area')).toBeInTheDocument();
  });

  // The default fixture plots min and max: two overlapping washes would stop
  // meaning "below this line".
  it('should leave several series unshaded', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.queryByTestId('series-area')).not.toBeInTheDocument();
  });

  // A run with no value leaves an empty row in the series, which would break
  // the line there. The series bridges it; the placement series, which only
  // hold those runs, must not, or they would draw a path between them.
  it('should bridge the series over runs that produced no value', () => {
    render(<TestSummaryGraph {...mockProps} />);

    const lineProps = (Line as unknown as jest.Mock).mock.calls.map(
      ([props]) => props
    );

    expect(lineProps.find((props) => props.dataKey === 'min')).toMatchObject({
      connectNulls: true,
    });
    expect(
      lineProps.find((props) => props.dataKey === 'abortedValue')
    ).not.toMatchObject({ connectNulls: true });
  });

  it('should publish the clicked run to the store', () => {
    render(<TestSummaryGraph {...mockProps} />);

    fireEvent.click(screen.getByTestId(POINT_TEST_ID));

    expect(mockSetSelectedRunTimestamp).toHaveBeenCalledWith(
      mockProps.testCaseResults[0].timestamp
    );
  });

  it('should tell the user the points are clickable', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.getByTestId('run-selection-hint')).toHaveTextContent(
      'message.click-a-point-for-run-details'
    );
  });

  it('should render incident areas when entity threads exist', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(
      queryByAttribute('id', document.body, `${mockProps.testCaseName}_graph`)
    ).toBeInTheDocument();
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

  it('should activate the tooltip only from the visible status dot', () => {
    jest.useFakeTimers();
    render(<TestSummaryGraph {...mockProps} />);

    const tooltip = screen.getByTestId(TOOLTIP_TEST_ID);

    expect(tooltip).toHaveAttribute(ACTIVE_ATTRIBUTE, INACTIVE_VALUE);
    expect(screen.getByTestId('line-min')).toHaveAttribute(
      'data-active-dot',
      INACTIVE_VALUE
    );

    const point = screen.getByTestId(POINT_TEST_ID);

    expect(point).toHaveAttribute('r', '4');
    expect(point.parentElement).toHaveAttribute('overflow', 'visible');
    expect(
      screen.queryByTestId('test-summary-point-hit-target-min')
    ).not.toBeInTheDocument();

    fireEvent.mouseEnter(point);

    expect(tooltip).toHaveAttribute(ACTIVE_ATTRIBUTE, ACTIVE_VALUE);
    expect(tooltip).toHaveAttribute(
      TOOLTIP_TRANSFORM_ATTRIBUTE,
      'translate(324px, 124px)'
    );
    expect(tooltip).toHaveAttribute(TOOLTIP_X_ATTRIBUTE, '324');
    expect(tooltip).toHaveAttribute(TOOLTIP_Y_ATTRIBUTE, '124');

    fireEvent.keyDown(point, {
      key: 'Escape',
    });

    expect(tooltip).toHaveAttribute(ACTIVE_ATTRIBUTE, INACTIVE_VALUE);

    fireEvent.mouseEnter(point);

    fireEvent.mouseLeave(point);
    fireEvent.mouseEnter(screen.getByTestId(TOOLTIP_CONTENT_TEST_ID));
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(tooltip).toHaveAttribute(ACTIVE_ATTRIBUTE, ACTIVE_VALUE);

    fireEvent.mouseLeave(screen.getByTestId(TOOLTIP_CONTENT_TEST_ID));
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(tooltip).toHaveAttribute(ACTIVE_ATTRIBUTE, INACTIVE_VALUE);

    jest.useRealTimers();
  });

  it('should keep the tooltip stable while the pointer crosses from the dot', () => {
    jest.useFakeTimers();
    render(<TestSummaryGraph {...mockProps} />);

    const point = screen.getByTestId(POINT_TEST_ID);
    const tooltip = screen.getByTestId(TOOLTIP_TEST_ID);

    fireEvent.mouseEnter(point);

    expect(tooltip).toHaveAttribute(TOOLTIP_X_ATTRIBUTE, '324');
    expect(tooltip).toHaveAttribute(TOOLTIP_Y_ATTRIBUTE, '124');

    fireEvent.mouseLeave(point);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(tooltip).toHaveAttribute(ACTIVE_ATTRIBUTE, ACTIVE_VALUE);
    expect(tooltip).toHaveAttribute('data-animation-active', INACTIVE_VALUE);

    fireEvent.mouseEnter(screen.getByTestId(TOOLTIP_CONTENT_TEST_ID));
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(tooltip).toHaveAttribute(ACTIVE_ATTRIBUTE, ACTIVE_VALUE);

    jest.useRealTimers();
  });

  it('should keep the seeded tooltip visible when its content has no size', () => {
    (HTMLElement.prototype.getBoundingClientRect as jest.Mock).mockReturnValue({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    });
    render(<TestSummaryGraph {...mockProps} />);

    const point = screen.getByTestId(POINT_TEST_ID);
    const tooltip = screen.getByTestId(TOOLTIP_TEST_ID);

    fireEvent.mouseEnter(point);

    expect(tooltip).toHaveAttribute(ACTIVE_ATTRIBUTE, ACTIVE_VALUE);
    expect(tooltip).toHaveAttribute('data-visibility', 'visible');
    expect(tooltip).toHaveAttribute(
      TOOLTIP_TRANSFORM_ATTRIBUTE,
      'translate(324px, 124px)'
    );
    expect(tooltip).toHaveAttribute(TOOLTIP_X_ATTRIBUTE, '324');
    expect(tooltip).toHaveAttribute(TOOLTIP_Y_ATTRIBUTE, '124');
  });

  it('should flip the fixed tooltip position when the chart edges would overflow', () => {
    mockPointCoordinate = { x: 760, y: 360 };
    const getBoundingClientRect = HTMLElement.prototype
      .getBoundingClientRect as jest.Mock;
    render(<TestSummaryGraph {...mockProps} />);

    const point = screen.getByTestId(POINT_TEST_ID);
    const tooltip = screen.getByTestId(TOOLTIP_TEST_ID);

    fireEvent.mouseEnter(point);

    expect(tooltip).toHaveAttribute(
      TOOLTIP_TRANSFORM_ATTRIBUTE,
      'translate(516px, 196px)'
    );
    expect(tooltip).toHaveAttribute(TOOLTIP_X_ATTRIBUTE, '516');
    expect(tooltip).toHaveAttribute(TOOLTIP_Y_ATTRIBUTE, '196');
    expect(tooltip).toHaveAttribute('data-visibility', 'visible');
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
  });
});
