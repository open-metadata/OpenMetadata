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
  act,
  fireEvent,
  queryByAttribute,
  render,
  screen,
} from '@testing-library/react';
import { Payload } from 'recharts/types/component/DefaultLegendContent';
import TestSummaryGraph from './TestSummaryGraph';
import { TestSummaryGraphProps } from './TestSummaryGraph.interface';

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

jest.mock('recharts', () => ({
  Area: jest.fn().mockImplementation(() => <div>Area</div>),
  CartesianGrid: jest.fn().mockImplementation(() => <div>CartesianGrid</div>),
  ComposedChart: jest.fn().mockImplementation(({ children, ...rest }) => (
    <div {...rest}>
      ComposedChart
      <div>{children}</div>
    </div>
  )),
  Legend: jest.fn().mockImplementation(({ payload, onClick, ...rest }) => (
    <div {...rest}>
      Legend
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
    </div>
  )),
  Line: jest.fn().mockImplementation((props) => {
    const { dataKey, hide } = props;

    return hide ? (
      <></>
    ) : (
      <div data-testid={`line-${dataKey}`} {...props}>
        Line
      </div>
    );
  }),
  ReferenceArea: jest.fn().mockImplementation(() => <div>ReferenceArea</div>),
  ReferenceLine: jest.fn().mockImplementation(() => <div>ReferenceLine</div>),
  ResponsiveContainer: jest.fn().mockImplementation(({ children, ...rest }) => (
    <div {...rest}>
      ResponsiveContainer
      <div>{children}</div>
    </div>
  )),
  Tooltip: jest.fn().mockImplementation(() => <div>Tooltip</div>),
  XAxis: jest.fn().mockImplementation(() => <div>XAxis</div>),
  YAxis: jest.fn().mockImplementation(() => <div>YAxis</div>),
}));

jest.mock('../../../common/DatePickerMenu/DatePickerMenu.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>DatePickerMenu.component</div>);
});
jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>ErrorPlaceHolder.component</div>);
});
jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});
jest.mock('../../SchemaEditor/SchemaEditor', () => {
  return jest.fn().mockImplementation(() => <div>SchemaEditor.component</div>);
});
jest.mock('../../../../utils/date-time/DateTimeUtils', () => {
  return {
    formatDateTime: jest.fn(),
    getCurrentMillis: jest.fn(),
    getEpochMillisForPastDays: jest.fn(),
  };
});

jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      entityThread: [],
    })),
  })
);
const mockSetShowAILearningBanner = jest.fn();
jest.mock(
  '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store',
  () => ({
    useTestCaseStore: jest.fn().mockImplementation(() => ({
      setShowAILearningBanner: mockSetShowAILearningBanner,
    })),
  })
);

describe('TestSummaryGraph', () => {
  it('should display error placeholder when the result data is empty', () => {
    render(<TestSummaryGraph {...mockProps} testCaseResults={[]} />);

    expect(screen.getByText('ErrorPlaceHolder.component')).toBeInTheDocument();
  });

  it('should display the graph when the test result data is present', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(
      queryByAttribute('id', document.body, `${mockProps.testCaseName}_graph`)
    ).toBeInTheDocument();
  });

  it('should render the legend with the correct data', async () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(screen.getByText('Legend')).toBeInTheDocument();
    expect(screen.getByTestId('min')).toBeInTheDocument();
    expect(screen.getByTestId('max')).toBeInTheDocument();
    expect(screen.getByTestId('Incident')).toBeInTheDocument();
  });

  it("legend filter should update the graph's activeKeys", async () => {
    render(<TestSummaryGraph {...mockProps} />);
    const minButton = screen.getByTestId('min');
    const minLineChart = screen.getByTestId('line-min');
    const maxLineChart = screen.getByTestId('line-max');

    expect(minButton).toBeInTheDocument();
    expect(minLineChart).toBeInTheDocument();
    expect(maxLineChart).toBeInTheDocument();

    screen.debug(document.body);

    await act(async () => {
      await fireEvent.click(minButton);
    });

    expect(minLineChart).toBeInTheDocument();
    expect(maxLineChart).not.toBeInTheDocument();
  });

  it('legend should not filter on Incident click', async () => {
    render(<TestSummaryGraph {...mockProps} />);
    const incidentButton = screen.getByTestId('Incident');
    const minLineChart = screen.getByTestId('line-min');
    const maxLineChart = screen.getByTestId('line-max');

    expect(incidentButton).toBeInTheDocument();
    expect(minLineChart).toBeInTheDocument();
    expect(maxLineChart).toBeInTheDocument();

    screen.debug(document.body);

    await act(async () => {
      await fireEvent.click(incidentButton);
    });

    expect(minLineChart).toBeInTheDocument();
    expect(maxLineChart).toBeInTheDocument();
  });

  it('should call mockSetShowAILearningBanner', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(mockSetShowAILearningBanner).toHaveBeenCalledWith(false);
  });
});
