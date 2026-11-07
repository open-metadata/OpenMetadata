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
  within,
} from '@testing-library/react';
import {
  OntologyBulkJob,
  Status,
} from '../../generated/api/data/ontologyBulkJob';
import { Operation } from '../../generated/api/data/ontologyBulkRequest';
import { OntologyBulkResultArtifact } from '../../generated/api/data/ontologyBulkResultArtifact';
import { ExecutionMode } from '../../generated/api/data/ontologyBulkSubmission';
import { MediaType } from '../../generated/api/data/ontologyBulkTemplate';
import { Glossary } from '../../generated/entity/data/glossary';
import { DEFAULT_POLL_INTERVAL_MS } from '../../hooks/usePollingEffect';
import {
  getOntologyBulkTemplate,
  listOntologyBulkJobs,
  submitOntologyBulkOperation,
} from '../../rest/ontologyAPI';
import { downloadCsv } from '../../utils/Export/ExportUtils';
import OntologyBulkAuthoring from './OntologyBulkAuthoring';

jest.mock('../../rest/ontologyAPI', () => ({
  cancelOntologyBulkJob: jest.fn(),
  getOntologyBulkTemplate: jest.fn(),
  listOntologyBulkJobs: jest.fn(),
  submitOntologyBulkOperation: jest.fn(),
}));

jest.mock('../../utils/Export/ExportUtils', () => ({
  downloadCsv: jest.fn(),
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
const mockDownloadCsv = downloadCsv as jest.MockedFunction<typeof downloadCsv>;

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
      expect(mockDownloadCsv).toHaveBeenCalledWith(
        expect.stringContaining('action,termId'),
        'ontology-bulk-template.csv'
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

  it('submits a background job and keeps polling via noteBackgroundSubmission until the job appears', async () => {
    jest.useFakeTimers();
    const backgroundJob: OntologyBulkJob = {
      createdAt: 1,
      createdBy: 'admin',
      dryRun: true,
      glossary: { id: GLOSSARY.id, type: 'glossary' },
      id: 42,
      operation: Operation.CSVUpsert,
      progress: 0,
      status: Status.Queued,
      total: 501,
      updatedAt: 1,
    };
    mockSubmit.mockResolvedValue({
      executionMode: ExecutionMode.Background,
      job: backgroundJob,
    });
    // The initial fetch and the immediate post-submit refresh both return an
    // empty list, so only noteBackgroundSubmission(42) keeps polling alive.
    mockListJobs.mockResolvedValue({ jobs: [] });

    render(
      <OntologyBulkAuthoring glossary={GLOSSARY} relationshipTypes={[]} />
    );

    // Wait for the initial mount fetch to settle.
    await waitFor(() => expect(mockListJobs).toHaveBeenCalledTimes(1));

    const csvInput = within(screen.getByTestId('ontology-bulk-csv')).getByRole(
      'textbox'
    );
    fireEvent.change(csvInput, {
      target: {
        value:
          'action,termId,name,displayName,description,parentId,iri\n' +
          'CREATE,91cdf0f6-9d67-4a74-ac63-af3df533e896,Customer,Customer,Customer concept,,',
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-bulk-submit'));
    });

    // The post-submit refresh ran but the job is still not in the list.
    // noteBackgroundSubmission(42) is the only reason polling stays active.
    await waitFor(() => expect(mockListJobs).toHaveBeenCalledTimes(2));

    expect(screen.queryByTestId('ontology-bulk-job-42')).toBeNull();

    // A later poll returns the queued job.
    mockListJobs.mockResolvedValue({ jobs: [backgroundJob] });
    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
    });

    expect(screen.getByTestId('ontology-bulk-job-42')).toHaveTextContent(
      'label.queued'
    );

    jest.useRealTimers();
  });
});
