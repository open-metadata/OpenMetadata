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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactComponent as IconSuccessBadge } from '../../../../assets/svg/success-badge.svg';
import {
  ErrorSource,
  ScheduleTimeline,
  Status,
} from '../../../../generated/entity/applications/appRunRecord';
import AppLogsViewer from './AppLogsViewer.component';

// Add TextEncoder polyfill
class MockTextEncoder {
  encoding = 'utf-8';
  encode() {
    return new Uint8Array();
  }
  encodeInto() {
    return { read: 0, written: 0 };
  }
}
global.TextEncoder = MockTextEncoder as unknown as typeof TextEncoder;

jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: jest.fn().mockReturnValue(<div data-testid="lazy-log-mock" />),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../../utils/date-time/DateTimeUtils'),
  formatDateTimeWithTimezone: jest
    .fn()
    .mockReturnValue('formatDateTimeWithTimezone'),
}));

jest.mock('../../../../utils/StringsUtils', () => ({
  formatJsonString: jest.fn().mockReturnValue('logs'),
}));

jest.mock('../../../common/CopyToClipboardButton/CopyToClipboardButton', () =>
  jest.fn().mockReturnValue(<>CopyToClipboardButton</>)
);

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Badge: jest.fn().mockReturnValue(<div>Badge</div>),
}));

jest.mock('../../../../utils/ApplicationUtils', () => ({
  // Use the real formatters so the wall-clock regression test asserts
  // the same display strings the user sees. getEntityStatsData stays
  // mocked because the existing tests assert on a specific shape.
  ...jest.requireActual('../../../../utils/ApplicationUtils'),
  getEntityStatsData: jest.fn().mockReturnValue([
    {
      name: 'chart',
      totalRecords: 100,
      failedRecords: 10,
      successRecords: 90,
    },
  ]),
}));

jest.mock('../../../common/Badge/Badge.component', () =>
  jest.fn().mockImplementation(({ label }) => {
    return <div data-testid="app-badge">{`${label}-AppBadge`}</div>;
  })
);

jest.mock('../../../../constants/constants', () => ({
  ...jest.requireActual('../../../../constants/constants'),
  ICON_DIMENSION: {
    with: 14,
    height: 14,
  },
  STATUS_ICON: {
    success: IconSuccessBadge,
  },
}));

const mockProps1 = {
  data: {
    appId: '6e4d3dcf-238d-4874-b4e4-dd863ede6544',
    status: Status.Success,
    runType: 'OnDemand',
    startTime: 1706871884587,
    endTime: 1706871891251,
    timestamp: 1706871884587,
    successContext: {
      stats: {
        jobStats: {
          totalRecords: 274,
          failedRecords: 0,
          successRecords: 274,
        },
      },
    },
    scheduleInfo: {
      scheduleTimeline: ScheduleTimeline.Custom,
      cronExpression: '0 0 0 1/1 * ? *',
    },
    id: '6e4d3dcf-238d-4874-b4e4-dd863ede6544-OnDemand-1706871884587',
  },
};

const mockProps2 = {
  data: {
    ...mockProps1.data,
    timestamp: undefined,
    successContext: undefined,
    failureContext: {
      stats: {
        jobStats: {
          totalRecords: 274,
          failedRecords: 0,
          successRecords: 274,
        },
      },
    },
  },
};

const mockProps3 = {
  data: {
    ...mockProps1.data,
    successContext: {
      stats: {
        jobStats: {
          totalRecords: 274,
          failedRecords: 4,
          successRecords: 270,
        },
        entityStats: {
          chart: {
            totalRecords: 100,
            failedRecords: 10,
            successRecords: 90,
          },
        },
      },
    },
  },
};

const mockProps4 = {
  data: {
    ...mockProps1.data,
    successContext: undefined,
    failureContext: {
      stats: {
        jobStats: {
          totalRecords: 274,
          failedRecords: 4,
          successRecords: 270,
        },
        entityStats: {
          chart: {
            totalRecords: 100,
            failedRecords: 10,
            successRecords: 90,
          },
        },
      },
    },
  },
};

const mockProps5 = {
  data: {
    ...mockProps1.data,
    successContext: {
      stats: undefined,
    },
    failureContext: {
      stats: undefined,
    },
  },
};

const mockProps6 = {
  data: {
    ...mockProps1.data,
    successContext: {
      stats: {},
    },
    failureContext: {
      failure: {
        message: 'Reindexing Job Has Encountered an Exception.',
        errorSource: ErrorSource.Job,
        failedEntities: [],
      },
    },
  },
};

const mockPropsWithProcessStats = {
  data: {
    ...mockProps1.data,
    successContext: {
      stats: {
        jobStats: {
          totalRecords: 274,
          failedRecords: 0,
          successRecords: 274,
        },
        readerStats: {
          totalRecords: 280,
          failedRecords: 2,
          successRecords: 278,
          warningRecords: 4,
        },
        processStats: {
          totalRecords: 278,
          failedRecords: 4,
          successRecords: 274,
          warningRecords: 0,
        },
        sinkStats: {
          totalRecords: 274,
          failedRecords: 0,
          successRecords: 274,
        },
      },
    },
  },
};

const mockPropsWithVectorStats = {
  data: {
    ...mockProps1.data,
    successContext: {
      stats: {
        jobStats: {
          totalRecords: 274,
          failedRecords: 0,
          successRecords: 274,
        },
        vectorStats: {
          totalRecords: 274,
          failedRecords: 10,
          successRecords: 264,
          warningRecords: 5,
        },
      },
    },
  },
};

const mockPropsWithAllPipelineStats = {
  data: {
    ...mockProps1.data,
    successContext: {
      stats: {
        jobStats: {
          totalRecords: 300,
          failedRecords: 10,
          successRecords: 290,
        },
        readerStats: {
          totalRecords: 310,
          failedRecords: 5,
          successRecords: 305,
          warningRecords: 3,
        },
        processStats: {
          totalRecords: 305,
          failedRecords: 5,
          successRecords: 300,
        },
        sinkStats: {
          totalRecords: 300,
          failedRecords: 5,
          successRecords: 295,
        },
        vectorStats: {
          totalRecords: 295,
          failedRecords: 5,
          successRecords: 290,
        },
      },
    },
  },
};

describe('AppLogsViewer component', () => {
  it('should contain all necessary elements', () => {
    render(<AppLogsViewer {...mockProps1} />);

    expect(screen.getByText('label.status:')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('label.index-states:')).toBeInTheDocument();
    expect(screen.getAllByText('Badge')).toHaveLength(3);
    expect(screen.getByText('label.last-updated:')).toBeInTheDocument();
    expect(screen.getByText('formatDateTimeWithTimezone')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'label.jump-to-end' }));

    expect(screen.getByText('CopyToClipboardButton')).toBeInTheDocument();
  });

  it('should render necessary element based on mockProps2', () => {
    render(<AppLogsViewer {...mockProps2} />);

    expect(screen.getByText('--')).toBeInTheDocument();
    // Note: not asserting other elements as for failure also same elements will render
  });

  it("should not render entity stats table based if successContext doesn't have data", () => {
    render(<AppLogsViewer {...mockProps1} />);

    expect(
      screen.queryByTestId('app-entity-stats-history-table')
    ).not.toBeInTheDocument();
  });

  it('should render entity stats table based if SuccessContext has data', () => {
    render(<AppLogsViewer {...mockProps3} />);

    expect(
      screen.getByTestId('app-entity-stats-history-table')
    ).toBeInTheDocument();

    expect(screen.getByText('label.name')).toBeInTheDocument();

    expect(screen.getAllByTestId('app-badge')).toHaveLength(3);
    expect(screen.getByText('274-AppBadge')).toBeInTheDocument();
    expect(screen.getByText('270-AppBadge')).toBeInTheDocument();
    expect(screen.getByText('4-AppBadge')).toBeInTheDocument();
  });

  it("should not render entity stats table based if failedContext doesn't have data", () => {
    render(<AppLogsViewer {...mockProps2} />);

    expect(
      screen.queryByTestId('app-entity-stats-history-table')
    ).not.toBeInTheDocument();
  });

  it('should render entity stats table based if failedContext has data', () => {
    render(<AppLogsViewer {...mockProps4} />);

    expect(
      screen.getByTestId('app-entity-stats-history-table')
    ).toBeInTheDocument();

    expect(screen.getByText('label.name')).toBeInTheDocument();

    expect(screen.getAllByTestId('app-badge')).toHaveLength(3);
    expect(screen.getByText('274-AppBadge')).toBeInTheDocument();
    expect(screen.getByText('270-AppBadge')).toBeInTheDocument();
    expect(screen.getByText('4-AppBadge')).toBeInTheDocument();
  });

  it('should not render stats and entityStats component if successContext and failureContext stats is empty', () => {
    render(<AppLogsViewer {...mockProps5} />);

    expect(screen.queryByTestId('stats-component')).not.toBeInTheDocument();

    expect(
      screen.queryByTestId('app-entity-stats-history-table')
    ).not.toBeInTheDocument();
  });

  it('should render failedContext data', async () => {
    render(<AppLogsViewer {...mockProps6} />);

    expect(screen.queryByTestId('stats-component')).not.toBeInTheDocument();

    expect(
      screen.queryByTestId('app-entity-stats-history-table')
    ).not.toBeInTheDocument();

    expect(await screen.findByTestId('lazy-log')).toBeInTheDocument();
  });

  it('should render process stats when processStats is present', () => {
    render(<AppLogsViewer {...mockPropsWithProcessStats} />);

    expect(
      screen.getByTestId('stats-component-label.process-stat-plural')
    ).toBeInTheDocument();
  });

  it('should render vector stats when vectorStats is present', () => {
    render(<AppLogsViewer {...mockPropsWithVectorStats} />);

    expect(
      screen.getByTestId('stats-component-label.vector-stat-plural')
    ).toBeInTheDocument();
  });

  it('should render all pipeline stats in correct order', () => {
    render(<AppLogsViewer {...mockPropsWithAllPipelineStats} />);

    expect(
      screen.getByTestId('stats-component-label.overall-stat-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('stats-component-label.reader-stat-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('stats-component-label.process-stat-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('stats-component-label.sink-stat-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('stats-component-label.vector-stat-plural')
    ).toBeInTheDocument();
  });

  it('should not render process stats when processStats is not present', () => {
    render(<AppLogsViewer {...mockProps1} />);

    expect(
      screen.queryByTestId('stats-component-label.process-stat-plural')
    ).not.toBeInTheDocument();
  });

  it('should not render vector stats when vectorStats is not present', () => {
    render(<AppLogsViewer {...mockProps1} />);

    expect(
      screen.queryByTestId('stats-component-label.vector-stat-plural')
    ).not.toBeInTheDocument();
  });

  // Regression: the overall card must derive Latency / throughput from
  // wall-clock (endTime - startTime) and NOT from jobStats.totalTimeMs,
  // which is never populated and previously produced a misleading
  // "<1 ms · >Nk r/s" reading. See PR #27872.
  it('overall stats card uses wall-clock not jobStats.totalTimeMs', () => {
    const wallClockProps = {
      data: {
        ...mockProps1.data,
        // 10 second wall-clock window.
        startTime: 1_700_000_000_000,
        endTime: 1_700_000_010_000,
        successContext: {
          stats: {
            jobStats: {
              totalRecords: 100,
              successRecords: 100,
              failedRecords: 0,
              // Deliberately 0 — this is the misleading source we are
              // moving away from. With wall-clock math (10s, 100 records)
              // the rate must be 10.0 r/s, not the >100k r/s the old
              // code produced when it divided by a 1ms floor.
              totalTimeMs: 0,
            },
          },
        },
      },
    };

    render(<AppLogsViewer {...wallClockProps} />);

    const overall = screen.getByTestId(
      'stats-component-label.overall-stat-plural'
    );

    // Label is the wall-clock variant, not "Latency".
    expect(overall).toHaveTextContent('label.wall-clock');
    expect(overall).not.toHaveTextContent('label.latency');

    // wall-clock = 10000ms, 100 records → 100 ms per record · 10.0 r/s.
    // If the component regresses to using jobStats.totalTimeMs (= 0)
    // the displayed rate would be ">100k r/s" via the 1ms floor, which
    // these assertions catch.
    expect(overall).toHaveTextContent('100.0 ms');
    expect(overall).toHaveTextContent('10.0 r/s');
    expect(overall).not.toHaveTextContent(/k r\/s/);
  });
});
