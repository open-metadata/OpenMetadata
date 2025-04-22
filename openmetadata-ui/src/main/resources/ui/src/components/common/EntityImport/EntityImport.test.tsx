/*
 *  Copyright 2023 Collate.
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
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import {
  CSVImportResult,
  Status,
} from '../../../generated/type/csvImportResult';
import { EntityImport } from './EntityImport.component';

let mockCsvImportResult = {
  dryRun: true,
  status: 'success',
  numberOfRowsProcessed: 3,
  numberOfRowsPassed: 3,
  numberOfRowsFailed: 0,
  importResultsCsv: `status,details,parent,name*,displayName,description,synonyms,relatedTerms,references,tags\r
  success,Entity created,,Glossary2 Term,Glossary2 Term displayName,Description for Glossary2 Term,,,,\r
  success,Entity created,,Glossary2 term2,Glossary2 term2,Description data.,,,,\r`,
} as CSVImportResult;

const mockAsyncImportJob = {
  jobId: '123',
  message: 'Import initiated successfully',
};

const mockProps = {
  entityName: 'Business Glossary',
  onImport: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockAsyncImportJob)),
  onSuccess: jest.fn(),
  onCancel: jest.fn(),
};

const mockCsvContent = `parent,name*,displayName,description*,synonyms,relatedTerms,references,tags
,Glossary2 Term,Glossary2 Term,Description for Glossary2 Term,,,,
,Glossary2 term2,Glossary2 term2,Description data.,,,,`;
const mockIncorrectCsvContent = `parent,name*,displayName,description*,synonyms,relatedTerms,references,tags
,,Glossary2 Term,Glossary2 Term,Description for Glossary2 Term,,,,
,,Glossary2 term2,Glossary2 term2,Description data.,,,,
`;

jest.mock(
  '../../Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => {
    return jest.fn().mockImplementation(() => <div>Stepper</div>);
  }
);
jest.mock('../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});
jest.mock('./ImportStatus/ImportStatus.component', () => ({
  ImportStatus: jest.fn().mockImplementation(() => <div>ImportStatus</div>),
}));

jest.mock('../../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn(),
}));

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
};

describe('EntityImport component', () => {
  beforeEach(() => {
    (useWebSocketConnector as jest.Mock).mockReturnValue({
      socket: mockSocket,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Component should render', async () => {
    render(<EntityImport {...mockProps}>ImportTableData</EntityImport>);

    expect(await screen.findByText('Stepper')).toBeInTheDocument();
    expect(
      await screen.findByTestId('upload-file-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('upload-file-widget')).toBeInTheDocument();
    expect(await screen.findByTestId('cancel-button')).toBeInTheDocument();
  });

  it('Cancel button should work', async () => {
    render(<EntityImport {...mockProps}>ImportTableData</EntityImport>);
    const cancelBtn = await screen.findByTestId('cancel-button');

    expect(cancelBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(cancelBtn);
    });

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('Import should work for success csv file scenario', async () => {
    const file = new File([mockCsvContent], 'glossary-terms.csv', {
      type: 'text/plain',
    });
    const flushPromises = () => new Promise(setImmediate);

    render(<EntityImport {...mockProps}>ImportTableData</EntityImport>);

    const uploadDragger = await waitFor(() =>
      screen.getByTestId('upload-file-widget')
    );

    expect(uploadDragger).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(uploadDragger, { target: { files: [file] } });
    });
    await act(async () => {
      await flushPromises();
    });

    expect(
      await screen.findByText(mockAsyncImportJob.message)
    ).toBeInTheDocument();

    const mockResponse = {
      jobId: mockAsyncImportJob.jobId,
      status: 'COMPLETED',
      result: mockCsvImportResult,
      error: null,
    };

    const callback = mockSocket.on.mock.calls[0][1];
    act(() => {
      callback(JSON.stringify(mockResponse));
    });

    const importButton = await screen.findByTestId('import-button');

    expect(await screen.findByTestId('import-results')).toBeInTheDocument();
    expect(importButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(importButton);
    });

    const callback1 = mockSocket.on.mock.calls[0][1];
    act(() => {
      callback1(JSON.stringify(mockResponse));
    });

    const successBadge = await screen.findByTestId('success-badge');
    const previewButton = await screen.findByTestId('preview-button');
    const fileName = await screen.findByTestId('file-name');

    expect(successBadge).toBeInTheDocument();
    expect(previewButton).toBeInTheDocument();
    expect(fileName).toHaveTextContent('glossary-terms.csv');

    await act(async () => {
      fireEvent.click(previewButton);
    });

    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('Import Should work for partial success', async () => {
    mockCsvImportResult = {
      ...mockCsvImportResult,
      status: Status.PartialSuccess,
    };

    const file = new File([mockCsvContent], 'glossary-terms.csv', {
      type: 'text/plain',
    });
    const flushPromises = () => new Promise(setImmediate);

    render(<EntityImport {...mockProps}>ImportTableData</EntityImport>);

    const uploadDragger = await waitFor(() =>
      screen.getByTestId('upload-file-widget')
    );

    expect(uploadDragger).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(uploadDragger, { target: { files: [file] } });
    });
    await act(async () => {
      await flushPromises();
    });

    expect(
      await screen.findByText(mockAsyncImportJob.message)
    ).toBeInTheDocument();

    const mockResponse = {
      jobId: mockAsyncImportJob.jobId,
      status: 'COMPLETED',
      result: mockCsvImportResult,
      error: null,
    };

    const callback = mockSocket.on.mock.calls[0][1];
    act(() => {
      callback(JSON.stringify(mockResponse));
    });

    const importButton = await screen.findByTestId('import-button');

    expect(await screen.findByTestId('import-results')).toBeInTheDocument();
    expect(importButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(importButton);
    });

    const callback1 = mockSocket.on.mock.calls[0][1];
    act(() => {
      callback1(JSON.stringify(mockResponse));
    });

    const successBadge = await screen.findByTestId('success-badge');
    const previewButton = await screen.findByTestId('preview-button');
    const fileName = await screen.findByTestId('file-name');

    expect(successBadge).toBeInTheDocument();
    expect(previewButton).toBeInTheDocument();
    expect(fileName).toHaveTextContent('glossary-terms.csv');

    await act(async () => {
      fireEvent.click(previewButton);
    });

    // once terms Partially imported redirect to glossary page
    expect(mockProps.onSuccess).toHaveBeenCalled();
  });

  it('Import Should not work for failure', async () => {
    mockCsvImportResult = { ...mockCsvImportResult, status: Status.Failure };

    const file = new File([mockIncorrectCsvContent], 'glossary-terms.csv', {
      type: 'text/plain',
    });
    const flushPromises = () => new Promise(setImmediate);

    render(<EntityImport {...mockProps}>ImportTableData</EntityImport>);

    const uploadDragger = await waitFor(() =>
      screen.getByTestId('upload-file-widget')
    );

    expect(uploadDragger).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(uploadDragger, { target: { files: [file] } });
    });
    await act(async () => {
      await flushPromises();
    });

    expect(
      await screen.findByText(mockAsyncImportJob.message)
    ).toBeInTheDocument();

    const mockResponse = {
      jobId: mockAsyncImportJob.jobId,
      status: 'COMPLETED',
      result: mockCsvImportResult,
      error: null,
    };

    const callback = mockSocket.on.mock.calls[0][1];
    act(() => {
      callback(JSON.stringify(mockResponse));
    });

    const importButton = screen.queryByTestId('import-button');
    const cancelPreviewButton = await screen.findByTestId(
      'preview-cancel-button'
    );

    expect(await screen.findByTestId('import-results')).toBeInTheDocument();

    // for failure import button should not render
    expect(importButton).not.toBeInTheDocument();

    expect(cancelPreviewButton).toBeInTheDocument();
  });

  it('Import Should not work for aborted', async () => {
    mockCsvImportResult = {
      ...mockCsvImportResult,
      status: Status.Aborted,
      abortReason: 'Something went wrong',
    };

    const file = new File([mockCsvContent], 'glossary-terms.csv', {
      type: 'text/plain',
    });
    const flushPromises = () => new Promise(setImmediate);

    render(<EntityImport {...mockProps}>ImportTableData</EntityImport>);

    const uploadDragger = await waitFor(() =>
      screen.getByTestId('upload-file-widget')
    );

    expect(uploadDragger).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(uploadDragger, { target: { files: [file] } });
    });
    await act(async () => {
      await flushPromises();
    });

    expect(
      await screen.findByText(mockAsyncImportJob.message)
    ).toBeInTheDocument();

    const mockResponse = {
      jobId: mockAsyncImportJob.jobId,
      status: 'COMPLETED',
      result: mockCsvImportResult,
      error: null,
    };

    const callback = mockSocket.on.mock.calls[0][1];
    act(() => {
      callback(JSON.stringify(mockResponse));
    });

    const abortedReason = await screen.findByTestId('abort-reason');
    const cancelButton = await screen.findByTestId('cancel-button');

    expect(abortedReason).toBeInTheDocument();
    expect(abortedReason).toHaveTextContent('Something went wrong');
    expect(cancelButton).toBeInTheDocument();
  });
});
