/*
 *  Copyright 2025 Collate.
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
import { ThemeProvider } from '@mui/material/styles';
import { createMuiTheme } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  CSVImportResult,
  Status,
} from '../../../../generated/type/csvImportResult';
import { BulkImportVersionSummary } from './BulkImportVersionSummary.component';

const theme = createMuiTheme();

const mockCsvImportResult: CSVImportResult = {
  dryRun: false,
  status: Status.Success,
  numberOfRowsProcessed: 2,
  numberOfRowsPassed: 2,
  numberOfRowsFailed: 0,
  importResultsCsv:
    'status,details,name\r\nsuccess,Entity created,TestTerm1\r\nsuccess,Entity created,TestTerm2\r\n',
};

const mockReadString = jest.fn();

jest.mock('react-papaparse', () => ({
  usePapaParse: () => ({
    readString: mockReadString,
  }),
}));

jest.mock(
  '../../../common/EntityImport/ImportStatus/ImportStatus.component',
  () => ({
    ImportStatus: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="import-status">ImportStatus</div>
      )),
  })
);

jest.mock('react-data-grid', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="data-grid">DataGrid</div>);
});

jest.mock('../../../../utils/CSV/CSV.utils', () => ({
  renderColumnDataEditor: jest
    .fn()
    .mockImplementation((column, data) => data.value),
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('BulkImportVersionSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadString.mockImplementation((csv, options) => {
      options.complete({
        data: [
          ['status', 'details', 'name'],
          ['success', 'Entity created', 'TestTerm1'],
          ['success', 'Entity created', 'TestTerm2'],
        ],
      });
    });
  });

  it('should render ImportStatus component', () => {
    renderWithTheme(
      <BulkImportVersionSummary csvImportResult={mockCsvImportResult} />
    );

    expect(screen.getByTestId('import-status')).toBeInTheDocument();
  });

  it('should render View More button', () => {
    renderWithTheme(
      <BulkImportVersionSummary csvImportResult={mockCsvImportResult} />
    );

    expect(screen.getByTestId('view-more-button')).toBeInTheDocument();
    expect(screen.getByText('label.view-more')).toBeInTheDocument();
  });

  it('should open modal when View More button is clicked', async () => {
    renderWithTheme(
      <BulkImportVersionSummary csvImportResult={mockCsvImportResult} />
    );

    const viewMoreButton = screen.getByTestId('view-more-button');

    await act(async () => {
      fireEvent.click(viewMoreButton);
    });

    expect(screen.getByTestId('bulk-import-details-modal')).toBeInTheDocument();
    expect(screen.getByText('label.bulk-import-entity')).toBeInTheDocument();
  });

  it('should parse CSV and render DataGrid when modal opens', async () => {
    renderWithTheme(
      <BulkImportVersionSummary csvImportResult={mockCsvImportResult} />
    );

    const viewMoreButton = screen.getByTestId('view-more-button');

    await act(async () => {
      fireEvent.click(viewMoreButton);
    });

    expect(mockReadString).toHaveBeenCalledWith(
      mockCsvImportResult.importResultsCsv,
      expect.objectContaining({
        worker: true,
        skipEmptyLines: true,
      })
    );

    expect(screen.getByTestId('data-grid')).toBeInTheDocument();
  });

  it('should close modal when close button is clicked', async () => {
    renderWithTheme(
      <BulkImportVersionSummary csvImportResult={mockCsvImportResult} />
    );

    const viewMoreButton = screen.getByTestId('view-more-button');

    await act(async () => {
      fireEvent.click(viewMoreButton);
    });

    expect(screen.getByTestId('bulk-import-details-modal')).toBeInTheDocument();
    expect(screen.getByTestId('close-modal-button')).toBeInTheDocument();

    const closeButton = screen.getByTestId('close-modal-button');

    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('close-modal-button')
      ).not.toBeInTheDocument();
    });
  });

  it('should not parse CSV again if already parsed', async () => {
    renderWithTheme(
      <BulkImportVersionSummary csvImportResult={mockCsvImportResult} />
    );

    const viewMoreButton = screen.getByTestId('view-more-button');

    await act(async () => {
      fireEvent.click(viewMoreButton);
    });

    expect(mockReadString).toHaveBeenCalledTimes(1);

    const closeButton = screen.getByTestId('close-modal-button');

    await act(async () => {
      fireEvent.click(closeButton);
    });

    await act(async () => {
      fireEvent.click(viewMoreButton);
    });

    expect(mockReadString).toHaveBeenCalledTimes(1);
  });

  it('should not parse CSV if importResultsCsv is not provided', async () => {
    const resultWithoutCsv: CSVImportResult = {
      ...mockCsvImportResult,
      importResultsCsv: undefined,
    };

    renderWithTheme(
      <BulkImportVersionSummary csvImportResult={resultWithoutCsv} />
    );

    const viewMoreButton = screen.getByTestId('view-more-button');

    await act(async () => {
      fireEvent.click(viewMoreButton);
    });

    expect(mockReadString).not.toHaveBeenCalled();
  });
});
