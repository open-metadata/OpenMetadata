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
import { fireEvent, render, screen } from '@testing-library/react';
import {
  LogsViewerModalProvider,
  useLogsViewerModal,
} from './LogsViewerModalProvider';

const mockUseIngestionPipelineLogs = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../hooks/useIngestionPipelineLogs', () => ({
  useIngestionPipelineLogs: (...args: unknown[]) =>
    mockUseIngestionPipelineLogs(...args),
}));

jest.mock(
  '../../components/common/LogViewerModal/LogViewerModal.component',
  () => ({
    __esModule: true,
    default: ({ open, title }: { open: boolean; title: string }) =>
      open ? <div data-testid="log-viewer-modal">{title}</div> : null,
  })
);

const Consumer = () => {
  const { openLogs } = useLogsViewerModal();

  return (
    <button
      onClick={() =>
        openLogs({ logEntityType: 'databaseServices', fqn: 'svc.pipeline' })
      }>
      open-logs
    </button>
  );
};

describe('LogsViewerModalProvider', () => {
  beforeEach(() => {
    mockUseIngestionPipelineLogs.mockReturnValue({
      logs: '',
      loading: false,
      loadingMore: false,
      hasMore: false,
      totalLines: 0,
      title: 'My Pipeline',
      downloading: false,
      loadMore: jest.fn(),
      download: jest.fn(),
    });
  });

  it('does not render the modal until openLogs is called', () => {
    render(
      <LogsViewerModalProvider>
        <Consumer />
      </LogsViewerModalProvider>
    );

    expect(screen.queryByTestId('log-viewer-modal')).not.toBeInTheDocument();
  });

  it('opens the modal with the resolved title when openLogs is called', () => {
    render(
      <LogsViewerModalProvider>
        <Consumer />
      </LogsViewerModalProvider>
    );

    fireEvent.click(screen.getByText('open-logs'));

    expect(screen.getByTestId('log-viewer-modal')).toHaveTextContent(
      'My Pipeline · label.log-plural'
    );
    expect(mockUseIngestionPipelineLogs).toHaveBeenCalledWith({
      logEntityType: 'databaseServices',
      fqn: 'svc.pipeline',
      runId: undefined,
    });
  });
});
