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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Operation } from '../../generated/api/data/ontologyBulkRequest';
import { OntologyBulkResultArtifact } from '../../generated/api/data/ontologyBulkResultArtifact';
import { ExecutionMode } from '../../generated/api/data/ontologyBulkSubmission';
import { MediaType } from '../../generated/api/data/ontologyBulkTemplate';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  getOntologyBulkTemplate,
  listOntologyBulkJobs,
  submitOntologyBulkOperation,
} from '../../rest/ontologyAPI';
import { downloadFile } from '../../utils/Export/ExportUtils';
import OntologyBulkAuthoring from './OntologyBulkAuthoring';

jest.mock('../../rest/ontologyAPI', () => ({
  cancelOntologyBulkJob: jest.fn(),
  getOntologyBulkTemplate: jest.fn(),
  listOntologyBulkJobs: jest.fn(),
  submitOntologyBulkOperation: jest.fn(),
}));

jest.mock('../../utils/Export/ExportUtils', () => ({
  downloadFile: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const GLOSSARY: Glossary = {
  description: 'Business vocabulary',
  displayName: 'Commerce',
  id: '831c26a6-e266-43d6-bca5-f116dcc31a46',
  name: 'Commerce',
};

const RESULT: OntologyBulkResultArtifact = {
  createCount: 1,
  dryRun: true,
  errors: [],
  errorsTruncated: false,
  findReplaceCount: 0,
  generatedAt: 1,
  generatedBy: 'admin',
  glossary: { id: GLOSSARY.id, type: 'glossary' },
  id: '91cdf0f6-9d67-4a74-ac63-af3df533e896',
  invalidRows: 0,
  operation: Operation.CSVUpsert,
  retypeCount: 0,
  totalRows: 1,
  unchangedRows: 0,
  updateCount: 0,
  validRows: 1,
};

const mockGetTemplate = getOntologyBulkTemplate as jest.MockedFunction<
  typeof getOntologyBulkTemplate
>;
const mockListJobs = listOntologyBulkJobs as jest.MockedFunction<
  typeof listOntologyBulkJobs
>;
const mockSubmit = submitOntologyBulkOperation as jest.MockedFunction<
  typeof submitOntologyBulkOperation
>;
const mockDownloadFile = downloadFile as jest.MockedFunction<
  typeof downloadFile
>;

describe('OntologyBulkAuthoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListJobs.mockResolvedValue({ jobs: [] });
    mockGetTemplate.mockResolvedValue({
      csv: 'action,termId,name,displayName,description,parentId,iri',
      fileName: 'ontology-bulk-template.csv',
      headers: [
        'action',
        'termId',
        'name',
        'displayName',
        'description',
        'parentId',
        'iri',
      ],
      maximumSynchronousRows: 500,
      mediaType: MediaType.TextCSV,
    });
  });

  it('requires one selected glossary', () => {
    render(<OntologyBulkAuthoring relationshipTypes={[]} />);

    expect(screen.getByText('label.select-entity')).toBeVisible();
  });

  it('downloads the server-provided typed CSV template', async () => {
    render(
      <OntologyBulkAuthoring glossary={GLOSSARY} relationshipTypes={[]} />
    );

    fireEvent.click(
      await screen.findByTestId('ontology-bulk-download-template')
    );

    await waitFor(() =>
      expect(mockDownloadFile).toHaveBeenCalledWith(
        expect.stringContaining('action,termId'),
        'ontology-bulk-template.csv',
        'text/csv'
      )
    );
  });

  it('submits a dry run and renders typed validation counts', async () => {
    mockSubmit.mockResolvedValue({
      executionMode: ExecutionMode.Synchronous,
      result: RESULT,
    });
    render(
      <OntologyBulkAuthoring glossary={GLOSSARY} relationshipTypes={[]} />
    );

    const csvInput = within(
      await screen.findByTestId('ontology-bulk-csv')
    ).getByRole('textbox');
    fireEvent.change(csvInput, {
      target: {
        value:
          'action,termId,name,displayName,description,parentId,iri\n' +
          'CREATE,91cdf0f6-9d67-4a74-ac63-af3df533e896,Customer,Customer,Customer concept,,',
      },
    });
    fireEvent.click(screen.getByTestId('ontology-bulk-submit'));

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true,
          glossaryId: GLOSSARY.id,
          operation: Operation.CSVUpsert,
        })
      )
    );

    expect(await screen.findByTestId('ontology-bulk-result')).toHaveTextContent(
      '1'
    );
    expect(screen.getAllByText('label.valid')).not.toHaveLength(0);
  });
});
