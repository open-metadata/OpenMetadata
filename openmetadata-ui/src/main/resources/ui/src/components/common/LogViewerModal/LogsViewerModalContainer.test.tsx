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
import { render, screen } from '@testing-library/react';
import LogsViewerModalContainer from './LogsViewerModalContainer';

const mockUseEntityLogs = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../hooks/useEntityLogs', () => ({
  useEntityLogs: (...args: unknown[]) => mockUseEntityLogs(...args),
}));

jest.mock('./LogViewerModal.component', () => ({
  __esModule: true,
  default: ({ title, mode }: { title: string; mode?: string }) => (
    <div data-mode={mode} data-testid="log-viewer-modal">
      {title}
    </div>
  ),
}));

const baseResult = {
  logs: '',
  loading: false,
  loadingMore: false,
  hasMore: false,
  totalLines: 0,
  title: 'My Pipeline',
  downloading: false,
  isLive: false,
  loadMore: jest.fn(),
  download: jest.fn(),
};

describe('LogsViewerModalContainer', () => {
  beforeEach(() => {
    mockUseEntityLogs.mockReturnValue(baseResult);
  });

  it('renders the modal with the resolved title and feeds params to the hook', () => {
    render(
      <LogsViewerModalContainer
        fqn="svc.pipeline"
        logEntityType="databaseServices"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('log-viewer-modal')).toHaveTextContent(
      'My Pipeline · label.log-plural'
    );
    expect(mockUseEntityLogs).toHaveBeenCalledWith({
      logEntityType: 'databaseServices',
      fqn: 'svc.pipeline',
      runId: undefined,
    });
  });

  it('uses stream mode while the run is live', () => {
    mockUseEntityLogs.mockReturnValue({
      ...baseResult,
      isLive: true,
    });

    render(
      <LogsViewerModalContainer
        fqn="svc.pipeline"
        logEntityType="databaseServices"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('log-viewer-modal')).toHaveAttribute(
      'data-mode',
      'stream'
    );
  });
});
