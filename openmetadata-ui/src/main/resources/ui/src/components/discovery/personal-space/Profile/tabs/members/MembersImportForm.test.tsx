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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { SOCKET_EVENTS } from '../../../../../../constants/constants';
import { importTeam, importUserInTeam } from '../../../../../../rest/teamsAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

// Controllable socket so tests can capture the registered handler and emit
// payloads, and assert cleanup removes only this component's listener.
const mockSocket = { on: jest.fn(), off: jest.fn() };

jest.mock(
  '../../../../../../context/WebSocketProvider/WebSocketProvider',
  () => ({ useWebSocketConnector: () => ({ socket: mockSocket }) })
);

jest.mock('../../../../../../rest/teamsAPI', () => ({
  importTeam: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
  importUserInTeam: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./MembersImportResultTable', () => () => (
  <div data-testid="import-result-table" />
));

import MembersImportForm from './MembersImportForm';

const emitCsvImportChannel = (payload: Record<string, unknown>) => {
  const call = mockSocket.on.mock.calls.find(
    ([channel]) => channel === SOCKET_EVENTS.CSV_IMPORT_CHANNEL
  );
  act(() => {
    call?.[1](JSON.stringify(payload));
  });
};

const selectFileAndStartPreview = async () => {
  const input = screen.getByTestId('members-import-input');
  const file = new File(['name,email\nfoo,foo@x.io'], 'teams.csv', {
    type: 'text/csv',
  });

  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });

  await waitFor(() => expect(screen.getByTestId('next-preview')).toBeEnabled());

  await act(async () => {
    fireEvent.click(screen.getByTestId('next-preview'));
  });
};

describe('MembersImportForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the stepper with the upload step active', () => {
    render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('active-step')).toHaveTextContent('0');
    expect(screen.getByTestId('csv-workflow-step-0')).toHaveAttribute(
      'data-active',
      'true'
    );
    expect(screen.getByTestId('csv-workflow-step-1')).toHaveAttribute(
      'data-active',
      'false'
    );
  });

  it('disables Next until a file is selected and Cancel closes', () => {
    const onClose = jest.fn();
    render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={onClose}
      />
    );

    expect(screen.getByTestId('next-preview')).toBeDisabled();

    fireEvent.click(screen.getByTestId('cancel-import'));

    expect(onClose).toHaveBeenCalled();
  });

  it('unsubscribes only its own socket handler on unmount', () => {
    const { unmount } = render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={jest.fn()}
      />
    );

    const onCall = mockSocket.on.mock.calls.find(
      ([channel]) => channel === SOCKET_EVENTS.CSV_IMPORT_CHANNEL
    );

    unmount();

    // off must be called with the SAME channel + handler reference — a bare
    // off(channel) would also drop the app-wide CsvJobsTray subscription.
    expect(mockSocket.off).toHaveBeenCalledWith(onCall?.[0], onCall?.[1]);
  });

  it('clears the spinner and surfaces an error when the import job FAILS', async () => {
    render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={jest.fn()}
      />
    );

    await selectFileAndStartPreview();

    emitCsvImportChannel({ jobId: 'job-1', status: 'FAILED', error: 'Boom' });

    expect(showErrorToast).toHaveBeenCalledWith('Boom');
    // Spinner gone, back on the upload step the user can retry from.
    expect(screen.getByTestId('active-step')).toHaveTextContent('0');
    expect(screen.queryByTestId('members-import-footer')).toBeInTheDocument();
  });

  it('shows the result table (not a success screen) when the import result is a Failure', async () => {
    render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={jest.fn()}
      />
    );

    await selectFileAndStartPreview();

    // Preview passes → advances to the validate step.
    emitCsvImportChannel({
      jobId: 'job-1',
      status: 'COMPLETED',
      result: {
        status: 'success',
        numberOfRowsPassed: 1,
        numberOfRowsProcessed: 1,
        numberOfRowsFailed: 0,
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-import'));
    });

    // The real import comes back a Failure.
    emitCsvImportChannel({
      jobId: 'job-1',
      status: 'COMPLETED',
      result: {
        status: 'failure',
        numberOfRowsPassed: 0,
        numberOfRowsProcessed: 1,
        numberOfRowsFailed: 1,
      },
    });

    expect(screen.getByTestId('import-result-table')).toBeInTheDocument();
    expect(screen.queryByTestId('import-success')).not.toBeInTheDocument();
  });

  it('previews with dryRun=true and runs the real import with dryRun=false', async () => {
    render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={jest.fn()}
      />
    );

    await selectFileAndStartPreview();

    expect(importTeam).toHaveBeenLastCalledWith(
      'Organization',
      expect.any(String),
      true
    );

    emitCsvImportChannel({
      jobId: 'job-1',
      status: 'COMPLETED',
      result: {
        status: 'success',
        numberOfRowsPassed: 1,
        numberOfRowsProcessed: 1,
        numberOfRowsFailed: 0,
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-import'));
    });

    expect(importTeam).toHaveBeenLastCalledWith(
      'Organization',
      expect.any(String),
      false
    );
  });

  it('uses importUserInTeam for the users import type', async () => {
    render(
      <MembersImportForm
        fqn="Engineering"
        importType="users"
        onClose={jest.fn()}
      />
    );

    await selectFileAndStartPreview();

    expect(importUserInTeam).toHaveBeenCalledWith(
      'Engineering',
      expect.any(String),
      true
    );
    expect(importTeam).not.toHaveBeenCalled();
  });

  it('ignores a websocket response for a different jobId', async () => {
    render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={jest.fn()}
      />
    );

    await selectFileAndStartPreview();

    emitCsvImportChannel({
      jobId: 'some-other-job',
      status: 'COMPLETED',
      result: {
        status: 'success',
        numberOfRowsPassed: 1,
        numberOfRowsProcessed: 1,
        numberOfRowsFailed: 0,
      },
    });

    // Stale event is dropped — still on the upload step, no result rendered.
    expect(screen.getByTestId('active-step')).toHaveTextContent('0');
    expect(screen.queryByTestId('import-result-table')).not.toBeInTheDocument();
  });

  it('keeps the upload step on an aborted dry-run so the user can retry', async () => {
    render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={jest.fn()}
      />
    );

    await selectFileAndStartPreview();

    emitCsvImportChannel({
      jobId: 'job-1',
      status: 'COMPLETED',
      result: {
        status: 'aborted',
        numberOfRowsPassed: 0,
        numberOfRowsProcessed: 0,
        numberOfRowsFailed: 0,
      },
    });

    expect(screen.getByTestId('active-step')).toHaveTextContent('0');
  });
});
