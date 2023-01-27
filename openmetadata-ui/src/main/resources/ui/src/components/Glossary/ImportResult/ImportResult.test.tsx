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
  findByText,
  getAllByRole,
  render,
  screen,
} from '@testing-library/react';
import { CSVImportResult } from 'generated/type/csvImportResult';
import React from 'react';
import ImportResult from './ImportResult';

const mockCsvImportResult = {
  dryRun: true,
  status: 'success',
  numberOfRowsProcessed: 3,
  numberOfRowsPassed: 3,
  numberOfRowsFailed: 0,
  importResultsCsv: `status,details,parent,name*,displayName,description*,synonyms,relatedTerms,references,tags\r
  success,Entity updated,,Glossary2 Term,Glossary2 Term displayName,Description for Glossary2 Term,,,,\r
  success,Entity updated,,Glossary2 term2,Glossary2 term2,Description data.,,,,\r`,
};

describe('Import Results', () => {
  it('Should render the results', async () => {
    render(
      <ImportResult csvImportResult={mockCsvImportResult as CSVImportResult} />
    );

    const processedRow = await screen.getByTestId('processed-row');
    const passedRow = await screen.getByTestId('passed-row');
    const failedRow = await screen.getByTestId('failed-row');

    expect(processedRow).toHaveTextContent('3');
    expect(passedRow).toHaveTextContent('3');
    expect(failedRow).toHaveTextContent('0');

    expect(await screen.getByTestId('import-result-table')).toBeInTheDocument();
  });

  it('Should render the parsed result', async () => {
    const { container } = render(
      <ImportResult csvImportResult={mockCsvImportResult as CSVImportResult} />
    );

    const tableRows = getAllByRole(container, 'row');

    expect(tableRows).toHaveLength(3);

    const firstRow = tableRows[1];

    const rowStatus = await findByText(firstRow, 'success');
    const rowDetails = await findByText(firstRow, 'Entity updated');
    const rowName = await findByText(firstRow, 'Glossary2 Term');
    const rowDisplayName = await findByText(
      firstRow,
      'Glossary2 Term displayName'
    );
    const rowDescription = await findByText(
      firstRow,
      'Description for Glossary2 Term'
    );

    expect(rowStatus).toBeInTheDocument();
    expect(rowDetails).toBeInTheDocument();
    expect(rowName).toBeInTheDocument();
    expect(rowDisplayName).toBeInTheDocument();
    expect(rowDescription).toBeInTheDocument();
  });
});
