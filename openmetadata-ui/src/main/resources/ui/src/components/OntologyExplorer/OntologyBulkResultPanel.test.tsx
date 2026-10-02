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
  ErrorCode,
  OntologyBulkResultArtifact,
  Operation,
} from '../../generated/api/data/ontologyBulkResultArtifact';
import { downloadFile } from '../../utils/Export/ExportUtils';
import OntologyBulkResultPanel from './OntologyBulkResultPanel';

jest.mock('../../utils/Export/ExportUtils', () => ({
  downloadFile: jest.fn(),
}));

const result = (
  overrides: Partial<OntologyBulkResultArtifact> = {}
): OntologyBulkResultArtifact => ({
  createCount: 1,
  dryRun: true,
  errors: [],
  errorsTruncated: false,
  findReplaceCount: 0,
  generatedAt: 1,
  generatedBy: 'admin',
  glossary: { id: 'glossary-id', type: 'glossary' },
  id: 'result-id',
  invalidRows: 2,
  operation: Operation.CSVUpsert,
  retypeCount: 0,
  totalRows: 10,
  unchangedRows: 3,
  updateCount: 0,
  validRows: 5,
  ...overrides,
});

const download = () =>
  fireEvent.click(
    screen.getByRole('button', { name: 'label.download label.result' })
  );

describe('OntologyBulkResultPanel', () => {
  it('renders a dry-run preview with counts and a success alert when error-free', () => {
    render(<OntologyBulkResultPanel result={result()} />);

    expect(screen.getByText('label.preview')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByTestId('alert-title')).toHaveTextContent('label.valid');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    download();

    expect(downloadFile).toHaveBeenCalledWith(
      JSON.stringify(result(), null, 2),
      'ontology-bulk-result.json',
      'application/json;charset=utf-8;'
    );
  });

  it('renders the created change set by display name and names the file after the job', () => {
    render(
      <OntologyBulkResultPanel
        jobId={42}
        result={result({
          changeSet: {
            displayName: 'Q3 cleanup',
            id: 'cs-id',
            name: 'q3_cleanup',
            type: 'ontologyChangeSet',
          },
          dryRun: false,
        })}
      />
    );

    expect(screen.getByText('label.draft-created')).toBeInTheDocument();
    expect(screen.getByText('Q3 cleanup')).toBeInTheDocument();

    download();

    expect(downloadFile).toHaveBeenCalledWith(
      expect.any(String),
      'ontology-bulk-42.json',
      'application/json;charset=utf-8;'
    );
  });

  it('falls back to the change set name without a display name', () => {
    render(
      <OntologyBulkResultPanel
        result={result({
          changeSet: {
            id: 'cs-id',
            name: 'q3_cleanup',
            type: 'ontologyChangeSet',
          },
        })}
      />
    );

    expect(screen.getByText('q3_cleanup')).toBeInTheDocument();
  });

  it('lists row errors and flags truncation', () => {
    render(
      <OntologyBulkResultPanel
        result={result({
          errors: [
            {
              code: ErrorCode.InvalidHeader,
              message: 'Missing name column',
              rowNumber: 1,
            },
            {
              code: ErrorCode.DuplicateTerm,
              message: 'Account already exists',
              rowNumber: 4,
            },
          ],
          errorsTruncated: true,
        })}
      />
    );

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('INVALID_HEADER')).toBeInTheDocument();
    expect(screen.getByText('Missing name column')).toBeInTheDocument();
    expect(screen.getByText('Account already exists')).toBeInTheDocument();
    expect(
      screen.getByText('label.error-plural · label.max')
    ).toBeInTheDocument();
  });

  it('omits the truncation alert when all errors are listed', () => {
    render(
      <OntologyBulkResultPanel
        result={result({
          errors: [
            { code: ErrorCode.InvalidIRI, message: 'Bad IRI', rowNumber: 2 },
          ],
        })}
      />
    );

    expect(screen.getByText('Bad IRI')).toBeInTheDocument();
    expect(
      screen.queryByText('label.error-plural · label.max')
    ).not.toBeInTheDocument();
  });
});
