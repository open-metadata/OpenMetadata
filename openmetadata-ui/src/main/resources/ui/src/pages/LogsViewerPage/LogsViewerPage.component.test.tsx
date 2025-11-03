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
    palette: { mode: 'light' },
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
      }: {
        text: string;
        onScroll: (args: {
          scrollTop: number;
          scrollHeight: number;
          clientHeight: number;
        }) => void;
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
        <div data-testid="lazy-log">
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
});
