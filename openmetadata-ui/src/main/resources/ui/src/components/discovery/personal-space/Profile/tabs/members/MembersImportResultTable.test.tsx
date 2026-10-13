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
import { render, screen, waitFor } from '@testing-library/react';
import { CSVImportResult } from '../../../../../../generated/type/csvImportResult';
import MembersImportResultTable from './MembersImportResultTable';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

// Drive the parser synchronously from a per-test fixture rather than parsing
// real CSV, so the test asserts the table mapping, not papaparse. readString
// must be a STABLE reference — the component effect depends on it, so a fresh
// function each render would loop forever.
let mockRows: string[][] = [];
const mockReadString = (
  _csv: string,
  opts: { complete: (r: { data: string[][] }) => void }
) => opts.complete({ data: mockRows });
jest.mock('react-papaparse', () => ({
  usePapaParse: () => ({ readString: mockReadString }),
}));

const renderTable = (importResultsCsv = 'ignored') =>
  render(
    <MembersImportResultTable
      csvImportResult={{ importResultsCsv } as CSVImportResult}
    />
  );

describe('MembersImportResultTable', () => {
  it('renders a success badge and the data columns (status/details folded in)', async () => {
    mockRows = [
      ['name*', 'status', 'details'],
      ['Alice', 'success', ''],
    ];
    renderTable();

    await waitFor(() =>
      expect(screen.getByTestId('import-result-table')).toBeInTheDocument()
    );

    expect(screen.getByTestId('success-badge')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders a failure badge with the inline details message', async () => {
    mockRows = [
      ['name*', 'status', 'details'],
      ['Bob', 'failure', 'Email invalid'],
    ];
    renderTable();

    await waitFor(() =>
      expect(screen.getByTestId('failure-badge')).toBeInTheDocument()
    );

    expect(screen.getByText('Email invalid')).toBeInTheDocument();
  });

  it('renders no rows when the result CSV is empty', async () => {
    mockRows = [];
    render(
      <MembersImportResultTable csvImportResult={{} as CSVImportResult} />
    );

    await waitFor(() =>
      expect(screen.getByTestId('import-result-table')).toBeInTheDocument()
    );

    expect(screen.queryByTestId('success-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('failure-badge')).not.toBeInTheDocument();
  });
});
