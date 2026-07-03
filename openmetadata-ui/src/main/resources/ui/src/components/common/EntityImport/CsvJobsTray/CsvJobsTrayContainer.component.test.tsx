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
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { CSV_JOBS_REFRESH_EVENT } from './CsvJobsTray.constants';
import { CsvJobsTrayContainer } from './CsvJobsTrayContainer.component';

jest.mock('./CsvJobsTray.component', () => ({
  CsvJobsTray: jest.fn(() => <div data-testid="csv-jobs-tray" />),
}));

describe('CsvJobsTrayContainer', () => {
  it('renders nothing and does not load the tray before any CSV job starts', () => {
    const { CsvJobsTray } = require('./CsvJobsTray.component');
    render(<CsvJobsTrayContainer />);

    expect(screen.queryByTestId('csv-jobs-tray')).not.toBeInTheDocument();
    expect(CsvJobsTray).not.toHaveBeenCalled();
  });

  it('lazily mounts the tray once a CSV job refresh event is dispatched', async () => {
    render(<CsvJobsTrayContainer />);

    act(() => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    expect(await screen.findByTestId('csv-jobs-tray')).toBeInTheDocument();
  });
});
