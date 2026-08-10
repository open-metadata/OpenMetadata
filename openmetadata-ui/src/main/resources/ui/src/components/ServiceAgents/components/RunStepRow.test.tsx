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
  });

  it('should copy the raw logs alongside the title and message', async () => {
    renderRow();

    fireEvent.click(screen.getByText('label.copy'));

    await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));

    const copied = mockWriteText.mock.calls[0][0] as string;

    // The whole point of the button: the raw log body has to make it to the clipboard, not just
    // the one-line summary.
    expect(copied).toContain(attention.stackTrace);
    expect(copied).toContain(attention.title);
    expect(copied).toContain(attention.message);
    expect(copied).toContain(attention.hint);
  });

  it('should omit absent parts rather than copying empty gaps', async () => {
    renderRow({ hint: undefined, stackTrace: undefined });

    fireEvent.click(screen.getByText('label.copy'));

    await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));

    expect(mockWriteText.mock.calls[0][0]).toBe(
      `${attention.title}\n\n${attention.message}`
    );
  });

  it('should surface copied feedback after a successful write', async () => {
    renderRow();

    fireEvent.click(screen.getByText('label.copy'));

    expect(await screen.findByText('label.copied')).toBeInTheDocument();
  });

  it('should not throw when the clipboard API is unavailable', async () => {
    setClipboard(undefined);

    renderRow();

    expect(() => fireEvent.click(screen.getByText('label.copy'))).not.toThrow();
    expect(mockWriteText).not.toHaveBeenCalled();
  });
});
