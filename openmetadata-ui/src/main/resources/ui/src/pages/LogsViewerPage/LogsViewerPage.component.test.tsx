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

import { TextDecoder, TextEncoder } from 'util';
global.TextEncoder = TextEncoder as unknown as typeof TextEncoder;
global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;

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
import LogsViewerPage from './LogsViewerPage';

const mockScrollToIndex = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    logEntityType: 'TestSuite',
    ingestionName: 'ingestion_123456',
  }),
  useNavigate: jest.fn(),
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

jest.mock('./LogsViewerPageSkeleton.component', () => {
  return jest.fn().mockImplementation(() => <p>LogsViewerPageSkeleton</p>);
});

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

jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: React.forwardRef(({ text }: { text: string }, ref) => {
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

    return <div data-testid="lazy-log">{text}</div>;
  }),
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

  it('should show basic configuration for application in right panel', async () => {
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
    expect(screen.getByText('0 0 * * *')).toBeInTheDocument();

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
});
