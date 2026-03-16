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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  CSVImportResult,
  Status,
} from '../../../../generated/type/csvImportResult';
import { BulkImportVersionSummary } from './BulkImportVersionSummary.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest
    .fn()
    .mockImplementation(({ children, onClick, 'data-testid': testId }) => (
      <button data-testid={testId} onClick={onClick}>
        {children}
      </button>
    )),
  Dialog: Object.assign(
    jest
      .fn()
      .mockImplementation(({ children, title, showCloseButton, onClose }) => (
        <div>
          {title && <span>{title}</span>}
          {showCloseButton && (
            <button data-testid="close-modal-button" onClick={onClose} />
          )}
          {children}
        </div>
      )),
    {
      Content: jest
        .fn()
        .mockImplementation(({ children, 'data-testid': testId }) => (
          <div data-testid={testId}>{children}</div>
        )),
      Header: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
      Footer: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  Typography: jest
    .fn()
    .mockImplementation(
      ({ children, 'data-testid': testId, as: Tag = 'span' }) => (
        <Tag data-testid={testId}>{children}</Tag>
      )
    ),
  Modal: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  ModalOverlay: jest
    .fn()
    .mockImplementation(({ children, isOpen }) =>
      isOpen ? <div>{children}</div> : null
    ),
}));

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

jest.mock('react-data-grid', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="data-grid">DataGrid</div>);
});

jest.mock('../../../../utils/CSV/CSV.utils', () => ({
  renderColumnDataEditor: jest
    .fn()
    .mockImplementation((_column, data) => data.value),
}));

describe('BulkImportVersionSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadString.mockImplementation((_csv, options) => {
      options.complete({
        data: [
          ['status', 'details', 'name'],
          ['success', 'Entity created', 'TestTerm1'],
          ['success', 'Entity created', 'TestTerm2'],
        ],
      });
    });
  });

  it('should render bulk import stats in column layout', () => {
    render(<BulkImportVersionSummary csvImportResult={mockCsvImportResult} />);

    expect(screen.getByText('label.rows-processed:')).toBeInTheDocument();
    expect(screen.getByTestId('processed-row')).toHaveTextContent('2');
    expect(screen.getByText('label.passed:')).toBeInTheDocument();
    expect(screen.getByTestId('passed-row')).toHaveTextContent('2');
    expect(screen.getByText('label.failed:')).toBeInTheDocument();
    expect(screen.getByTestId('failed-row')).toHaveTextContent('0');
  });

  it('should render View More button', () => {
    render(<BulkImportVersionSummary csvImportResult={mockCsvImportResult} />);

    expect(screen.getByTestId('view-more-button')).toBeInTheDocument();
    expect(screen.getByText('label.view-more')).toBeInTheDocument();
  });

  it('should open modal when View More button is clicked', async () => {
    render(<BulkImportVersionSummary csvImportResult={mockCsvImportResult} />);

    const viewMoreButton = screen.getByTestId('view-more-button');

    fireEvent.click(viewMoreButton);

    await waitFor(() =>
      expect(
        screen.getByTestId('bulk-import-details-modal')
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText('label.bulk-import-entity')).toBeInTheDocument()
    );
  });

  it('should parse CSV and render DataGrid when modal opens', async () => {
    render(<BulkImportVersionSummary csvImportResult={mockCsvImportResult} />);

    const viewMoreButton = screen.getByTestId('view-more-button');

    fireEvent.click(viewMoreButton);

    await waitFor(() =>
      expect(mockReadString).toHaveBeenCalledWith(
        mockCsvImportResult.importResultsCsv,
        expect.objectContaining({
          worker: true,
          skipEmptyLines: true,
        })
      )
    );

    expect(screen.getByTestId('data-grid')).toBeInTheDocument();
  });

  it('should close modal when close button is clicked', async () => {
    render(<BulkImportVersionSummary csvImportResult={mockCsvImportResult} />);

    const viewMoreButton = screen.getByTestId('view-more-button');

    fireEvent.click(viewMoreButton);

    await waitFor(() =>
      expect(
        screen.getByTestId('bulk-import-details-modal')
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByTestId('close-modal-button')).toBeInTheDocument()
    );

    const closeButton = screen.getByTestId('close-modal-button');

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(
        screen.queryByTestId('close-modal-button')
      ).not.toBeInTheDocument();
    });
  });

  it('should not parse CSV again if already parsed', async () => {
    render(<BulkImportVersionSummary csvImportResult={mockCsvImportResult} />);

    const viewMoreButton = screen.getByTestId('view-more-button');

    fireEvent.click(viewMoreButton);

    await waitFor(() => expect(mockReadString).toHaveBeenCalledTimes(1));

    const closeButton = screen.getByTestId('close-modal-button');

    fireEvent.click(closeButton);

    fireEvent.click(viewMoreButton);

    await waitFor(() => expect(mockReadString).toHaveBeenCalledTimes(1));
  });

  it('should not parse CSV if importResultsCsv is not provided', async () => {
    const resultWithoutCsv: CSVImportResult = {
      ...mockCsvImportResult,
      importResultsCsv: undefined,
    };

    render(<BulkImportVersionSummary csvImportResult={resultWithoutCsv} />);

    const viewMoreButton = screen.getByTestId('view-more-button');

    fireEvent.click(viewMoreButton);

    await waitFor(() => expect(mockReadString).not.toHaveBeenCalled());
  });
});
