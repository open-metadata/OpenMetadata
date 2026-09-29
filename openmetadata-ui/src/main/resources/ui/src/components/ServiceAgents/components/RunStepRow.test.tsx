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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RunAttention, RunStep } from '../AgentsPage.interface';
import RunStepRow from './RunStepRow.component';

const mockWriteText = jest.fn().mockResolvedValue(undefined);

const attention: RunAttention = {
  severity: 'error',
  title: 'Main Container Diagnostics',
  message: 'Workflow failed — check logs for details',
  hint: 'Inspect the pod logs for the failing container',
  stackTrace: 'Pod Description:\nStatus: Failed\nERROR boom',
};

const step: RunStep = {
  name: 'Pod Diagnostics',
  status: 'failed',
  records: 0,
  filtered: 0,
  updated: 0,
  warnings: 0,
  errors: 1,
  attention,
};

const setClipboard = (value: unknown) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value,
    writable: true,
  });
};

const renderRow = (override: Partial<RunAttention> = {}) =>
  render(
    <RunStepRow
      isLast
      step={{ ...step, attention: { ...attention, ...override } }}
    />
  );

describe('RunStepRow copy action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setClipboard({ writeText: mockWriteText });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  it('should copy the raw logs and nothing else', async () => {
    renderRow();

    fireEvent.click(screen.getByText('label.copy'));

    await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));

    // The title, message and hint are already on screen; pasting them alongside the log body is
    // noise, so the clipboard has to hold the log content verbatim.
    expect(mockWriteText).toHaveBeenCalledWith(attention.stackTrace);
  });

  it('should hide the copy button when the step has no raw logs', () => {
    renderRow({ stackTrace: undefined });

    expect(screen.queryByText('label.copy')).not.toBeInTheDocument();
    expect(screen.queryByText('label.show-raw-logs')).not.toBeInTheDocument();
  });

  it('should surface copied feedback after a successful write', async () => {
    renderRow();

    fireEvent.click(screen.getByText('label.copy'));

    expect(await screen.findByText('label.copied')).toBeInTheDocument();
  });

  it('should fall back to execCommand outside a secure context', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
      writable: true,
    });
    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
      writable: true,
    });

    renderRow();

    fireEvent.click(screen.getByText('label.copy'));

    expect(await screen.findByText('label.copied')).toBeInTheDocument();
    expect(mockWriteText).not.toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
