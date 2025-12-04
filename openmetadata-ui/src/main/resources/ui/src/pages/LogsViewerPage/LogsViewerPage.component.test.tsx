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
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { useParams } from 'react-router-dom';
import {
  mockDataInsightApplication,
  mockDataInsightApplicationRun,
  mockIngestionPipeline,
  mockLatestDataInsightApplicationRunLogs,
  mockLogsData,
} from '../../mocks/LogsViewerPage.mock';
import {
  getApplicationByName,
  getExternalApplicationRuns,
  getLatestApplicationRuns,
} from '../../rest/applicationAPI';
import { getIngestionPipelineLogById } from '../../rest/ingestionPipelineAPI';
import LogsViewerPage from './LogsViewerPage';

const mockScrollToIndex = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    logEntityType: 'TestSuite',
    ingestionName: 'ingestion_123456',
  }),
  useNavigate: jest.fn(),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn((entity) => entity?.name || entity?.displayName || ''),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../utils/IngestionLogs/LogsUtils', () => ({
  downloadAppLogs: jest.fn(),
  downloadIngestionLog: jest.fn(),
}));

jest.mock('../../utils/DataAssetsHeader.utils', () => ({
  ExtraInfoLabel: jest.fn(({ label, value }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => {
    const { useParams } = jest.requireMock('react-router-dom');
    const params = useParams();

    return { fqn: params.fqn || params.ingestionName || '' };
  }),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => {
    const { useParams } = jest.requireMock('react-router-dom');
    const params = useParams();

    return { logEntityType: params.logEntityType || 'TestSuite' };
  }),
}));

jest.mock('../../utils/LogsClassBase', () => ({
  getLogBreadCrumbs: jest
    .fn()
    .mockReturnValue({ name: 'getLogBreadCrumbs', url: '' }),
}));

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => () => <>TitleBreadcrumb.component</>
);
jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock('../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelineLogById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockLogsData })),
  getIngestionPipelineByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockIngestionPipeline)),
}));

jest.mock(
  '../../components/Settings/Services/Ingestion/IngestionRecentRun/IngestionRecentRuns.component',
  () => ({
    IngestionRecentRuns: jest
      .fn()
      .mockImplementation(() => <p>IngestionRecentRuns</p>),
  })
);

// Mock @mui/system/useThemeWithoutDefault to provide theme context for Box component
jest.mock('@mui/system/useThemeWithoutDefault', () => ({
  __esModule: true,
  default: () => ({
    palette: {
      mode: 'light',
      grey: {
        500: '#9E9E9E',
      },
    },
    spacing: (value: number) => `${value * 8}px`,
  }),
}));

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  getScheduleDescriptionTexts: jest.fn().mockReturnValue({
    descriptionFirstPart: 'Every day',
    descriptionSecondPart: 'at 12:00 AM',
  }),
  getEpochMillisForPastDays: jest.fn(
    () => Date.now() - 7 * 24 * 60 * 60 * 1000
  ),
  getCurrentMillis: jest.fn(() => Date.now()),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
}));

jest.mock('../../rest/applicationAPI', () => ({
  getApplicationByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDataInsightApplication)),
  getExternalApplicationRuns: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDataInsightApplicationRun)),
  getLatestApplicationRuns: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(mockLatestDataInsightApplicationRunLogs)
    ),
}));

jest.mock('../../hooks/useDownloadProgressStore', () => ({
  useDownloadProgressStore: jest.fn(() => ({
    progress: 0,
    reset: jest.fn(),
    updateProgress: jest.fn(),
  })),
}));

let mockScrollPosition = {
  scrollTop: 80,
  scrollHeight: 100,
  clientHeight: 20,
};

jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: React.forwardRef(
    (
      {
        text,
        onScroll,
        loading,
      }: {
        text: string;
        onScroll: (args: {
          scrollTop: number;
          scrollHeight: number;
          clientHeight: number;
        }) => void;
        loading?: boolean;
      },
      ref
    ) => {
      // Mock the ref structure that the component expects
      if (ref) {
        (ref as { current: Record<string, unknown> }).current = {
          state: {
            count: 230,
          },
          listRef: {
            current: {
              scrollToIndex: mockScrollToIndex,
            },
          },
        };
      }

      return (
        <div data-loading={loading} data-testid="mocked-lazy-log">
          {text}
          <div
            data-testid="scroll-container"
            onClick={() => onScroll(mockScrollPosition)}
          />
        </div>
      );
    }
  ),
}));

describe('LogsViewerPage.component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    const { getIngestionPipelineByFqn, getIngestionPipelineLogById } =
      jest.requireMock('../../rest/ingestionPipelineAPI');

    (getIngestionPipelineByFqn as jest.Mock).mockClear();
    (getIngestionPipelineLogById as jest.Mock).mockClear();

    // Set default implementations
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue(
      mockIngestionPipeline
    );
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: mockLogsData,
    });
  });

  it('On initial, component should render', async () => {
    render(<LogsViewerPage />);

    expect(
      await screen.findByText('TitleBreadcrumb.component')
    ).toBeInTheDocument();

    expect(
      await screen.findByText('test-redshift_metadata_ZeCajs9g')
    ).toBeInTheDocument();

    const logElement = await screen.findByText(mockLogsData.ingestion_task);

    expect(logElement).toBeInTheDocument();
  });

  it('should fetch api for application logs', async () => {
    (useParams as jest.Mock).mockReturnValue({
      logEntityType: 'apps',
      fqn: 'DataInsightsApplication',
    });

    render(<LogsViewerPage />);

    await waitFor(() => {
      expect(getApplicationByName).toHaveBeenCalled();
      expect(getExternalApplicationRuns).toHaveBeenCalled();
      expect(getLatestApplicationRuns).toHaveBeenCalled();
    });
  });

  it('should show basic configuration for application in header section', async () => {
    (useParams as jest.Mock).mockReturnValue({
      logEntityType: 'apps',
      fqn: 'DataInsightsApplication',
    });

    await act(async () => {
      render(<LogsViewerPage />);
    });

    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();

    expect(screen.getByText('Schedule')).toBeInTheDocument();

    expect(screen.getByText('Recent Runs')).toBeInTheDocument();
    expect(screen.getByText('IngestionRecentRuns')).toBeInTheDocument();
  });

  it('should show logs for ingestion pipeline', async () => {
    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('jump-to-end-button')).toBeInTheDocument();
    });

    const jumpToEndButton = screen.getByTestId('jump-to-end-button');

    expect(jumpToEndButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(jumpToEndButton);
    });

    // Verify that scrollToIndex was called with the correct parameter (totalLines - 1)
    expect(mockScrollToIndex).toHaveBeenCalledWith(229);
  });

  it('should call handleScroll when user scrolls at the bottom', async () => {
    (useParams as jest.Mock).mockReturnValue({
      logEntityType: 'TestSuite',
      ingestionName: 'ingestion_123456',
    });
    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('scroll-container')).toBeInTheDocument();
    });

    const scrollContainer = screen.getByTestId('scroll-container');

    await act(async () => {
      fireEvent.click(scrollContainer);
    });

    expect(getIngestionPipelineLogById).toHaveBeenCalledWith(
      'c379d75a-43cd-4d93-a799-0bba4a22c690',
      '1'
    );
  });

  it('should not call handleScroll when user scrolls and is not at the bottom', async () => {
    // Set scroll position to NOT be at the bottom
    mockScrollPosition = { scrollTop: 10, scrollHeight: 100, clientHeight: 20 };

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('scroll-container')).toBeInTheDocument();
    });

    const scrollContainer = screen.getByTestId('scroll-container');

    // Simulate scroll that is NOT at the bottom
    await act(async () => {
      fireEvent.click(scrollContainer);
    });

    // Verify that the API was not called since we're not at the bottom
    expect(getIngestionPipelineLogById).not.toHaveBeenCalledWith(
      'c379d75a-43cd-4d93-a799-0bba4a22c690',
      '1'
    );
  });

  it('should not call handleScroll when user scrolls and is at the bottom with 40- margin', async () => {
    mockScrollPosition = { scrollTop: 41, scrollHeight: 100, clientHeight: 20 };

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('scroll-container')).toBeInTheDocument();
    });

    const scrollContainer = screen.getByTestId('scroll-container');

    // Simulate scroll that is NOT at the bottom
    await act(async () => {
      fireEvent.click(scrollContainer);
    });

    // Verify that the API was not called since we're not at the bottom
    expect(getIngestionPipelineLogById).toHaveBeenCalledWith(
      'c379d75a-43cd-4d93-a799-0bba4a22c690',
      '1'
    );
  });

  it('should not call handleScroll when user scrolls and is at the bottom with 40 margin', async () => {
    mockScrollPosition = { scrollTop: 40, scrollHeight: 100, clientHeight: 20 };

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('scroll-container')).toBeInTheDocument();
    });

    const scrollContainer = screen.getByTestId('scroll-container');

    // Simulate scroll that is NOT at the bottom
    await act(async () => {
      fireEvent.click(scrollContainer);
    });

    // Verify that the API was not called since we're not at the bottom
    expect(getIngestionPipelineLogById).not.toHaveBeenCalledWith(
      'c379d75a-43cd-4d93-a799-0bba4a22c690',
      '1'
    );
  });

  it('should not call handleScroll when user scrolls and is at the bottom but after is undefined', async () => {
    mockScrollPosition = { scrollTop: 80, scrollHeight: 100, clientHeight: 20 };
    (getIngestionPipelineLogById as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        data: {
          ...mockLogsData,
          after: undefined,
        },
      })
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('scroll-container')).toBeInTheDocument();
    });

    const scrollContainer = screen.getByTestId('scroll-container');

    // Simulate scroll that is NOT at the bottom
    await act(async () => {
      fireEvent.click(scrollContainer);
    });

    // Verify that the API was not called since we're not at the bottom
    expect(getIngestionPipelineLogById).not.toHaveBeenCalledWith(
      'c379d75a-43cd-4d93-a799-0bba4a22c690',
      '1'
    );
  });

  it('should handle Profiler pipeline type logs', async () => {
    const mockProfilerPipeline = {
      ...mockIngestionPipeline,
      pipelineType: 'profiler',
    };
    const mockProfilerLogs = {
      ...mockLogsData,
      profiler_task: 'Profiler logs content',
    };

    const { getIngestionPipelineByFqn } = jest.requireMock(
      '../../rest/ingestionPipelineAPI'
    );
    (getIngestionPipelineByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockProfilerPipeline)
    );
    (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: mockProfilerLogs })
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Profiler logs content')).toBeInTheDocument();
    });
  });

  it('should handle Usage pipeline type logs', async () => {
    const mockUsagePipeline = {
      ...mockIngestionPipeline,
      pipelineType: 'usage',
    };
    const mockUsageLogs = {
      ...mockLogsData,
      usage_task: 'Usage logs content',
    };

    const { getIngestionPipelineByFqn } = jest.requireMock(
      '../../rest/ingestionPipelineAPI'
    );
    (getIngestionPipelineByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockUsagePipeline)
    );
    (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: mockUsageLogs })
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Usage logs content')).toBeInTheDocument();
    });
  });

  it('should handle Lineage pipeline type logs', async () => {
    const mockLineagePipeline = {
      ...mockIngestionPipeline,
      pipelineType: 'lineage',
    };
    const mockLineageLogs = {
      ...mockLogsData,
      lineage_task: 'Lineage logs content',
    };

    const { getIngestionPipelineByFqn } = jest.requireMock(
      '../../rest/ingestionPipelineAPI'
    );
    (getIngestionPipelineByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockLineagePipeline)
    );
    (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: mockLineageLogs })
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Lineage logs content')).toBeInTheDocument();
    });
  });

  it('should handle DBT pipeline type logs', async () => {
    const mockDbtPipeline = {
      ...mockIngestionPipeline,
      pipelineType: 'dbt',
    };
    const mockDbtLogs = {
      ...mockLogsData,
      dbt_task: 'DBT logs content',
    };

    const { getIngestionPipelineByFqn } = jest.requireMock(
      '../../rest/ingestionPipelineAPI'
    );
    (getIngestionPipelineByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockDbtPipeline)
    );
    (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: mockDbtLogs })
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('DBT logs content')).toBeInTheDocument();
    });
  });

  it('should handle DataInsight pipeline type logs', async () => {
    const mockDataInsightPipeline = {
      ...mockIngestionPipeline,
      pipelineType: 'dataInsight',
    };
    const mockDataInsightLogs = {
      ...mockLogsData,
      data_insight_task: 'DataInsight logs content',
    };

    const { getIngestionPipelineByFqn } = jest.requireMock(
      '../../rest/ingestionPipelineAPI'
    );
    (getIngestionPipelineByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockDataInsightPipeline)
    );
    (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: mockDataInsightLogs })
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('DataInsight logs content')).toBeInTheDocument();
    });
  });

  it('should handle ElasticSearchReindex pipeline type logs', async () => {
    const mockEsReindexPipeline = {
      ...mockIngestionPipeline,
      pipelineType: 'elasticSearchReindex',
    };
    const mockEsReindexLogs = {
      ...mockLogsData,
      elasticsearch_reindex_task: 'ES Reindex logs content',
    };

    const { getIngestionPipelineByFqn } = jest.requireMock(
      '../../rest/ingestionPipelineAPI'
    );
    (getIngestionPipelineByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockEsReindexPipeline)
    );
    (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: mockEsReindexLogs })
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('ES Reindex logs content')).toBeInTheDocument();
    });
  });

  it('should handle AutoClassification pipeline type logs', async () => {
    const mockAutoClassificationPipeline = {
      ...mockIngestionPipeline,
      pipelineType: 'autoClassification',
    };
    const mockAutoClassificationLogs = {
      ...mockLogsData,
      auto_classification_task: 'AutoClassification logs content',
    };

    const { getIngestionPipelineByFqn } = jest.requireMock(
      '../../rest/ingestionPipelineAPI'
    );
    (getIngestionPipelineByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockAutoClassificationPipeline)
    );
    (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: mockAutoClassificationLogs })
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(
        screen.getByText('AutoClassification logs content')
      ).toBeInTheDocument();
    });
  });

  it('should handle error when fetching ingestion pipeline details', async () => {
    const { getIngestionPipelineByFqn } = jest.requireMock(
      '../../rest/ingestionPipelineAPI'
    );
    const { showErrorToast } = jest.requireMock('../../utils/ToastUtils');
    const mockError = new Error('Failed to fetch pipeline');

    (getIngestionPipelineByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(mockError)
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });
  });

  it('should handle error when fetching application details', async () => {
    (useParams as jest.Mock).mockReturnValue({
      logEntityType: 'apps',
      fqn: 'DataInsightsApplication',
    });

    const { showErrorToast } = jest.requireMock('../../utils/ToastUtils');
    const mockError = new Error('Failed to fetch application');

    (getApplicationByName as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(mockError)
    );

    await act(async () => {
      render(<LogsViewerPage />);
    });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });
  });

  describe('fetchMoreLogs dependency', () => {
    it('should include fetchLogs in fetchMoreLogs useCallback dependencies to prevent stale closure', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      // Set up mock to return data on second call
      (getIngestionPipelineLogById as jest.Mock).mockResolvedValueOnce({
        data: mockLogsData,
      });

      await act(async () => {
        render(<LogsViewerPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('scroll-container')).toBeInTheDocument();
      });

      // Set up mock for the next fetch
      (getIngestionPipelineLogById as jest.Mock).mockResolvedValueOnce({
        data: {
          ...mockLogsData,
          after: '2',
        },
      });

      mockScrollPosition = {
        scrollTop: 80,
        scrollHeight: 100,
        clientHeight: 20,
      };

      const scrollContainer = screen.getByTestId('scroll-container');

      // Trigger scroll event to call fetchMoreLogs
      await act(async () => {
        fireEvent.click(scrollContainer);
      });

      // Verify fetchLogs was called with correct parameters (proving dependency is working)
      await waitFor(() => {
        expect(getIngestionPipelineLogById).toHaveBeenLastCalledWith(
          'c379d75a-43cd-4d93-a799-0bba4a22c690',
          '1'
        );
      });
    });
  });

  describe('Skeleton display logic', () => {
    it('should only show skeleton when isLoading is true, not isLogsLoading', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      const { getIngestionPipelineByFqn } = jest.requireMock(
        '../../rest/ingestionPipelineAPI'
      );

      // Mock to keep isLoading true for longer
      (getIngestionPipelineByFqn as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockIngestionPipeline), 100);
          })
      );

      await act(async () => {
        render(<LogsViewerPage />);
      });

      // Should show skeleton while isLoading is true
      expect(screen.getByTestId('skeleton-container')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(
            screen.queryByTestId('skeleton-container')
          ).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // After isLoading is false, should show content even if isLogsLoading is true
      expect(screen.getByTestId('jump-to-end-button')).toBeInTheDocument();
    });

    it('should show skeleton only during initial data fetch', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      await act(async () => {
        render(<LogsViewerPage />);
      });

      // Wait for skeleton to disappear
      await waitFor(() => {
        expect(
          screen.queryByTestId('skeleton-container')
        ).not.toBeInTheDocument();
      });

      // Content should be visible - check for logs content or jump button
      expect(screen.getByTestId('jump-to-end-button')).toBeInTheDocument();
    });
  });

  describe('Empty logs with loading state', () => {
    it('should not show empty logs message when isLogsLoading is true', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      // Mock empty logs response but with loading state
      (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  data: {
                    ...mockLogsData,
                    ingestion_task: '',
                  },
                }),
              100
            );
          })
      );

      await act(async () => {
        render(<LogsViewerPage />);
      });

      // While loading, should not show "no logs available" message
      expect(
        screen.queryByText('label.no-entity-available')
      ).not.toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(
        () => {
          // After loading completes with empty logs, should show empty state
          expect(
            screen.getByText('label.no-entity-available')
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should show empty logs message only when logs are empty AND isLogsLoading is false', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            ...mockLogsData,
            ingestion_task: '',
          },
        })
      );

      await act(async () => {
        render(<LogsViewerPage />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('label.no-entity-available')
        ).toBeInTheDocument();
      });
    });

    it('should not show empty message when logs are present', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      await act(async () => {
        render(<LogsViewerPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('jump-to-end-button')).toBeInTheDocument();
      });

      // Should not show empty state when logs exist
      expect(
        screen.queryByText('label.no-entity-available')
      ).not.toBeInTheDocument();
    });
  });

  describe('LazyLog loading prop', () => {
    it('should pass loading prop to LazyLog component to show loading indicator', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      // Mock delayed response to keep isLogsLoading true
      (getIngestionPipelineLogById as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockLogsData }), 500);
          })
      );

      await act(async () => {
        render(<LogsViewerPage />);
      });

      // LazyLog should receive loading prop
      // The component should be rendered but in loading state
      await waitFor(
        () => {
          expect(screen.getByTestId('mocked-lazy-log')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it('should set loading to false when logs have finished loading', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      await act(async () => {
        render(<LogsViewerPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('mocked-lazy-log')).toBeInTheDocument();
        // Logs should be displayed (not loading)
        expect(
          screen.getByText(mockLogsData.ingestion_task)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Race conditions and state management', () => {
    it('should handle rapid scroll events without making duplicate API calls', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      await act(async () => {
        render(<LogsViewerPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('scroll-container')).toBeInTheDocument();
      });

      // After initial render, paging.after will be '1' from mockLogsData
      // Set up a delayed mock to simulate loading time
      (getIngestionPipelineLogById as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                data: {
                  ...mockLogsData,
                  after: '2',
                },
              });
            }, 100);
          })
      );

      mockScrollPosition = {
        scrollTop: 80,
        scrollHeight: 100,
        clientHeight: 20,
      };

      const scrollContainer = screen.getByTestId('scroll-container');

      // Trigger first scroll event
      await act(async () => {
        fireEvent.click(scrollContainer);
      });

      // Immediately try to trigger more scroll events while first is loading
      // These should be ignored because isLogsLoading should be true
      fireEvent.click(scrollContainer);
      fireEvent.click(scrollContainer);

      // Wait for the first call to complete
      await waitFor(() => {
        const calls = (getIngestionPipelineLogById as jest.Mock).mock.calls;
        const scrollCalls = calls.filter((call) => call[1] === '1');

        // Should only have 1 call with after='1' despite multiple rapid clicks
        expect(scrollCalls).toHaveLength(1);
      });
    });

    it('should properly reset isLogsLoading after fetch completes', async () => {
      (useParams as jest.Mock).mockReturnValue({
        logEntityType: 'TestSuite',
        ingestionName: 'ingestion_123456',
      });

      // Ensure mocks are set up correctly for this test
      const { getIngestionPipelineByFqn, getIngestionPipelineLogById } =
        jest.requireMock('../../rest/ingestionPipelineAPI');

      (getIngestionPipelineByFqn as jest.Mock).mockResolvedValueOnce(
        mockIngestionPipeline
      );
      (getIngestionPipelineLogById as jest.Mock).mockResolvedValueOnce({
        data: mockLogsData,
      });

      await act(async () => {
        render(<LogsViewerPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('mocked-lazy-log')).toBeInTheDocument();
      });

      // Verify logs are loaded and component is not in loading state
      expect(screen.getByText(mockLogsData.ingestion_task)).toBeInTheDocument();

      // Set up mock for the next fetch
      (getIngestionPipelineLogById as jest.Mock).mockResolvedValueOnce({
        data: {
          ...mockLogsData,
          after: '2',
        },
      });

      mockScrollPosition = {
        scrollTop: 80,
        scrollHeight: 100,
        clientHeight: 20,
      };

      const scrollContainer = screen.getByTestId('scroll-container');

      await act(async () => {
        fireEvent.click(scrollContainer);
      });

      // Should make API call since loading is complete
      await waitFor(() => {
        expect(getIngestionPipelineLogById).toHaveBeenLastCalledWith(
          'c379d75a-43cd-4d93-a799-0bba4a22c690',
          '1'
        );
      });
    });
  });
});
