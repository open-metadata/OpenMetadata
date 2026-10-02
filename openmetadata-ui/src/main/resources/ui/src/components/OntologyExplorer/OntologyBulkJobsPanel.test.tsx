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

import { fireEvent, render, screen } from '@testing-library/react';
import {
  OntologyBulkJob,
  Operation,
  Status,
} from '../../generated/api/data/ontologyBulkJob';
import OntologyBulkJobsPanel from './OntologyBulkJobsPanel';

const job = (overrides: Partial<OntologyBulkJob> = {}): OntologyBulkJob => ({
  createdAt: 1,
  createdBy: 'admin',
  dryRun: false,
  glossary: { id: 'glossary-id', type: 'glossary' },
  id: 1,
  operation: Operation.CSVUpsert,
  progress: 2,
  status: Status.Completed,
  total: 10,
  updatedAt: 2,
  ...overrides,
});

const resultArtifact = {
  createCount: 0,
  dryRun: false,
  errors: [],
  errorsTruncated: false,
  findReplaceCount: 0,
  generatedAt: 1,
  generatedBy: 'admin',
  glossary: { id: 'glossary-id', type: 'glossary' },
  id: 'result-id',
  invalidRows: 0,
  operation: Operation.CSVUpsert,
  retypeCount: 0,
  totalRows: 0,
  unchangedRows: 0,
  updateCount: 0,
  validRows: 0,
};

const renderPanel = (
  props: Partial<React.ComponentProps<typeof OntologyBulkJobsPanel>> = {}
) => {
  const handlers = {
    onCancel: jest.fn(),
    onRefresh: jest.fn(),
    onViewResult: jest.fn(),
  };
  render(
    <OntologyBulkJobsPanel
      hasLoadError={false}
      isCancelling={false}
      isLoading={false}
      jobs={[]}
      {...handlers}
      {...props}
    />
  );

  return handlers;
};

describe('OntologyBulkJobsPanel', () => {
  it('shows the empty state and refreshes on demand', () => {
    const { onRefresh } = renderPanel();

    expect(screen.getByText('label.no-data')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.refresh' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('hides the empty state while loading and surfaces load errors', () => {
    renderPanel({ hasLoadError: true, isLoading: true });

    expect(screen.queryByText('label.no-data')).not.toBeInTheDocument();
    expect(screen.getByText('server.unexpected-error')).toBeInTheDocument();
  });

  it('labels every operation and status', () => {
    renderPanel({
      jobs: [
        job({ id: 1, operation: Operation.CSVUpsert, status: Status.Queued }),
        job({
          id: 2,
          operation: Operation.FindReplace,
          status: Status.Running,
        }),
        job({
          id: 3,
          operation: Operation.RetypeRelationships,
          status: Status.Completed,
        }),
        job({ id: 4, status: Status.Failed, error: 'Row 3 is invalid' }),
        job({ id: 5, status: Status.Cancelled }),
      ],
    });

    expect(screen.getByTestId('ontology-bulk-job-1')).toHaveTextContent(
      'label.csv label.upload'
    );
    expect(screen.getByTestId('ontology-bulk-job-1')).toHaveTextContent(
      'label.queued'
    );
    expect(screen.getByTestId('ontology-bulk-job-2')).toHaveTextContent(
      'label.find / label.replace'
    );
    expect(screen.getByTestId('ontology-bulk-job-2')).toHaveTextContent(
      'label.running'
    );
    expect(screen.getByTestId('ontology-bulk-job-3')).toHaveTextContent(
      'label.relationship-type label.edit'
    );
    expect(screen.getByTestId('ontology-bulk-job-3')).toHaveTextContent(
      'label.completed'
    );
    expect(screen.getByTestId('ontology-bulk-job-4')).toHaveTextContent(
      'label.failed'
    );
    expect(screen.getByTestId('ontology-bulk-job-4')).toHaveTextContent(
      'Row 3 is invalid'
    );
    expect(screen.getByTestId('ontology-bulk-job-5')).toHaveTextContent(
      'label.cancelled'
    );
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('offers cancel only for active jobs and wires it to the job id', () => {
    const { onCancel } = renderPanel({
      jobs: [
        job({ id: 7, status: Status.Running, total: 0 }),
        job({ id: 8, status: Status.Completed }),
      ],
    });

    const cancelButtons = screen.getAllByRole('button', {
      name: 'label.cancel',
    });

    expect(cancelButtons).toHaveLength(1);

    fireEvent.click(cancelButtons[0]);

    expect(onCancel).toHaveBeenCalledWith(7);
  });

  it('disables cancel while a cancellation is in flight', () => {
    renderPanel({
      isCancelling: true,
      jobs: [job({ status: Status.Queued })],
    });

    expect(screen.getByRole('button', { name: 'label.cancel' })).toBeDisabled();
  });

  it('offers the result view only for jobs with a result', () => {
    const withResult = job({ id: 9, result: resultArtifact });
    const { onViewResult } = renderPanel({
      jobs: [withResult, job({ id: 10 })],
    });

    const viewButtons = screen.getAllByRole('button', {
      name: 'label.view label.result',
    });

    expect(viewButtons).toHaveLength(1);

    fireEvent.click(viewButtons[0]);

    expect(onViewResult).toHaveBeenCalledWith(withResult);
  });
});
