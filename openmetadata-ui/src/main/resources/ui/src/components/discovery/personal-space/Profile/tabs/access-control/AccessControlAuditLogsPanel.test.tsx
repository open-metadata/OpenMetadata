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
import { parseDate } from '@internationalized/date';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode, useState } from 'react';
import {
  exportAuditLogs,
  getAuditLogExportJob,
  getAuditLogExportResult,
  getAuditLogs,
} from '../../../../../../rest/auditLogAPI';
import { showSuccessToast } from '../../../../../../utils/ToastUtils';
import { EXPORT_POLL_INTERVAL_MS } from './AccessControl.constants';
import AccessControlAuditLogsPanel from './AccessControlAuditLogsPanel';

// The real picker is a calendar overlay; a button picking a fixed range stands in for it.
jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  DateRangePicker: ({
    onChange,
  }: {
    onChange: (range: { start: unknown; end: unknown }) => void;
  }) => (
    <button
      aria-label="date-range"
      data-testid="export-date-range-picker"
      type="button"
      onClick={() =>
        onChange({
          start: parseDate('2026-10-01'),
          end: parseDate('2026-10-02'),
        })
      }
    />
  ),
}));

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/auditLogAPI', () => ({
  exportAuditLogs: jest.fn(),
  getAuditLogExportJob: jest.fn(),
  getAuditLogExportResult: jest.fn(),
  getAuditLogs: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../../context/WebSocketProvider/WebSocketProvider',
  () => ({ useWebSocketConnector: () => ({ socket: undefined }) })
);

let mockPageSize: number | undefined;

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useHashPagingParams: () => ({
    page: 1,
    pageSize: mockPageSize,
    cursor: undefined,
    cursorType: undefined,
    setPage: jest.fn(),
  }),
}));

jest.mock('../../../../../AuditLog/AuditLogList.component', () => () => (
  <div data-testid="audit-log-list" />
));

jest.mock('./AccessControlAuditLogFilters', () => () => (
  <div data-testid="audit-log-filters" />
));

// The panel injects its Export button into the page header, so mirror that here.
const PanelWithHeader = () => {
  const [actions, setActions] = useState<ReactNode>();

  return (
    <>
      {actions}
      <AccessControlAuditLogsPanel onSetHeaderActions={setActions} />
    </>
  );
};

describe('AccessControlAuditLogsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPageSize = undefined;
    (getAuditLogs as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 3 },
    });
  });

  it('opens the export form in a popover anchored to the header button', async () => {
    render(<PanelWithHeader />);

    fireEvent.click(await screen.findByTestId('export-audit-logs-button'));

    expect(
      await screen.findByTestId('export-audit-logs-popover')
    ).toBeInTheDocument();
    expect(screen.getByTestId('export-date-range-picker')).toBeInTheDocument();
    // No date range picked yet, so there is nothing to export.
    expect(
      screen.getByTestId('export-audit-logs-popover-confirm')
    ).toBeDisabled();
  });

  it('closes the export popover on cancel', async () => {
    render(<PanelWithHeader />);

    fireEvent.click(await screen.findByTestId('export-audit-logs-button'));
    fireEvent.click(
      await screen.findByTestId('export-audit-logs-popover-cancel')
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId('export-audit-logs-popover')
      ).not.toBeInTheDocument()
    );
  });

  it('exports the picked range, holding the popover until the job completes', async () => {
    (exportAuditLogs as jest.Mock).mockResolvedValue({
      jobId: 'job-1',
      message: 'started',
    });
    (getAuditLogExportJob as jest.Mock).mockResolvedValue({
      status: 'COMPLETED',
    });
    (getAuditLogExportResult as jest.Mock).mockResolvedValue('[]');
    URL.createObjectURL = jest.fn(() => 'blob:audit');
    URL.revokeObjectURL = jest.fn();
    render(<PanelWithHeader />);

    fireEvent.click(await screen.findByTestId('export-audit-logs-button'));
    fireEvent.click(await screen.findByTestId('export-date-range-picker'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('export-audit-logs-popover-confirm'));
    });

    expect(exportAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        startTs: new Date(2026, 9, 1, 0, 0, 0, 0).getTime(),
        endTs: new Date(2026, 9, 2, 23, 59, 59, 999).getTime(),
      })
    );
    // The job cannot be cancelled, so the popover holds until it ends.
    expect(
      screen.getByTestId('export-audit-logs-popover-cancel')
    ).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(EXPORT_POLL_INTERVAL_MS);
    });

    expect(getAuditLogExportResult).toHaveBeenCalledWith('job-1');
    expect(showSuccessToast).toHaveBeenCalledWith('message.export-successful');

    await waitFor(() =>
      expect(
        screen.queryByTestId('export-audit-logs-popover')
      ).not.toBeInTheDocument()
    );
  });

  it('hides pagination when one default-sized page holds every log', async () => {
    render(<PanelWithHeader />);

    await waitFor(() => expect(getAuditLogs).toHaveBeenCalled());

    expect(
      screen.queryByTestId('rows-per-page-dropdown')
    ).not.toBeInTheDocument();
  });

  it('keeps pagination at a non-default page size so it can be switched back', async () => {
    mockPageSize = 50;
    render(<PanelWithHeader />);

    expect(
      await screen.findByTestId('rows-per-page-dropdown')
    ).toBeInTheDocument();
  });
});
