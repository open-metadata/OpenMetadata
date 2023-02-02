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
  waitForElement,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CSVImportResult, Status } from 'generated/type/csvImportResult';
import React from 'react';
import ImportGlossary from './ImportGlossary';

const mockPush = jest.fn();
const glossaryName = 'Glossary1';
let mockCsvImportResult = {
  dryRun: true,
  status: 'success',
  numberOfRowsProcessed: 3,
  numberOfRowsPassed: 3,
  numberOfRowsFailed: 0,
  importResultsCsv: `status,details,parent,name*,displayName,description,synonyms,relatedTerms,references,tags\r
  success,Entity updated,,Glossary2 Term,Glossary2 Term displayName,Description for Glossary2 Term,,,,\r
  success,Entity updated,,Glossary2 term2,Glossary2 term2,Description data.,,,,\r`,
} as CSVImportResult;

const mockCsvContent = `parent,name*,displayName,description*,synonyms,relatedTerms,references,tags
,Glossary2 Term,Glossary2 Term,Description for Glossary2 Term,,,,
,Glossary2 term2,Glossary2 term2,Description data.,,,,`;

const mockIncorrectCsvContent = `parent,name*,displayName,description*,synonyms,relatedTerms,references,tags
,,Glossary2 Term,Glossary2 Term,Description for Glossary2 Term,,,,
,,Glossary2 term2,Glossary2 term2,Description data.,,,,
`;

jest.mock('components/common/title-breadcrumb/title-breadcrumb.component', () =>
  jest.fn().mockReturnValue(<div data-testid="breadcrumb">Breadcrumb</div>)
);

jest.mock('components/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../ImportResult/ImportResult', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="import-results">Import Result</div>)
);

jest.mock('rest/glossaryAPI', () => ({
  importGlossaryInCSVFormat: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockCsvImportResult)),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
}));

jest.mock('utils/RouterUtils', () => ({
  getGlossaryPath: jest.fn().mockImplementation(() => 'glossary-path'),
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('components/IngestionStepper/IngestionStepper.component', () =>
  jest.fn().mockReturnValue(<div data-testid="stepper">Stepper</div>)
);

describe('Import Glossary component should work properly', () => {
  it('Should render the all components', async () => {
    render(<ImportGlossary glossaryName={glossaryName} />);

    const breadcrumb = await screen.getByTestId('breadcrumb');
    const title = await screen.getByTestId('title');
    const uploader = await screen.getByTestId('upload-file-widget');
    const uploadButton = await screen.getByTestId('upload-button');
    const stepper = await screen.getByTestId('stepper');
    const cancelBtn = await screen.findByTestId('cancel-button');

    expect(breadcrumb).toBeInTheDocument();
    expect(title).toBeInTheDocument();
    expect(uploader).toBeInTheDocument();
    expect(uploadButton).toBeInTheDocument();
    expect(stepper).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(cancelBtn);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('Import functionality Should work flow should work properly', async () => {
    const file = new File([mockCsvContent], 'glossary-terms.csv', {
      type: 'text/plain',
    });
    const flushPromises = () => new Promise(setImmediate);

    render(<ImportGlossary glossaryName={glossaryName} />);

    const uploadDragger = await waitForElement(() =>
      screen.getByTestId('upload-file-widget')
    );

    expect(uploadDragger).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(uploadDragger, { target: { files: [file] } });
    });
    await act(async () => {
      await flushPromises();
    });

    const importButton = await screen.findByTestId('import-button');

    expect(await screen.findByTestId('import-results')).toBeInTheDocument();
    expect(importButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(importButton);
    });

    const successBadge = await screen.findByTestId('success-badge');
    const previewButton = await screen.findByTestId('preview-button');
    const fileName = await screen.findByTestId('file-name');

    expect(successBadge).toBeInTheDocument();
    expect(previewButton).toBeInTheDocument();
    expect(fileName).toHaveTextContent('glossary-terms.csv');

    await act(async () => {
      userEvent.click(previewButton);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
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

    render(<ImportGlossary glossaryName={glossaryName} />);

    const uploadDragger = await waitForElement(() =>
      screen.getByTestId('upload-file-widget')
    );

    expect(uploadDragger).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(uploadDragger, { target: { files: [file] } });
    });
    await act(async () => {
      await flushPromises();
    });

    const importButton = await screen.findByTestId('import-button');

    expect(await screen.findByTestId('import-results')).toBeInTheDocument();
    expect(importButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(importButton);
    });

    const successBadge = await screen.findByTestId('success-badge');
    const previewButton = await screen.findByTestId('preview-button');
    const fileName = await screen.findByTestId('file-name');

    expect(successBadge).toBeInTheDocument();
    expect(previewButton).toBeInTheDocument();
    expect(fileName).toHaveTextContent('glossary-terms.csv');

    await act(async () => {
      userEvent.click(previewButton);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('Import Should not work for failure', async () => {
    mockCsvImportResult = { ...mockCsvImportResult, status: Status.Failure };

    const file = new File([mockIncorrectCsvContent], 'glossary-terms.csv', {
      type: 'text/plain',
    });
    const flushPromises = () => new Promise(setImmediate);

    render(<ImportGlossary glossaryName={glossaryName} />);

    const uploadDragger = await waitForElement(() =>
      screen.getByTestId('upload-file-widget')
    );

    expect(uploadDragger).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(uploadDragger, { target: { files: [file] } });
    });
    await act(async () => {
      await flushPromises();
    });

    const importButton = screen.queryByTestId('import-button');
    const cancelPreviewButton = await screen.getByTestId(
      'preview-cancel-button'
    );

    expect(await screen.getByTestId('import-results')).toBeInTheDocument();

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

    render(<ImportGlossary glossaryName={glossaryName} />);

    const uploadDragger = await waitForElement(() =>
      screen.getByTestId('upload-file-widget')
    );

    expect(uploadDragger).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(uploadDragger, { target: { files: [file] } });
    });
    await act(async () => {
      await flushPromises();
    });

    const abortedReason = await screen.getByTestId('abort-reason');
    const cancelButton = await screen.getByTestId('cancel-button');

    expect(abortedReason).toBeInTheDocument();
    expect(abortedReason).toHaveTextContent('Something went wrong');
    expect(cancelButton).toBeInTheDocument();
  });
});
