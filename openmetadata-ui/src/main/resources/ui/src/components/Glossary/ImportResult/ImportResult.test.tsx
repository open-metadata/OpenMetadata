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
  findByTestId,
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
  importResultsCsv: `status,details,parent,name*,displayName,description,synonyms,relatedTerms,references,tags\r
success,Entity updated,,Glossary2 Term,Glossary2 Term displayName,Description for Glossary2 Term,,,,\r
success,Entity updated,,Glossary2 term2,Glossary2 term2 displayname,"Description, data.","ter1,term2",,,\r
failure,#INVALID_FIELD: Field 6 error - Entity First Name not found,test,Glossary3 term3,Glossary3 term3 displayname,"Description2, data.","ter3,term4",,,\r`,
};

describe('Import Results component should work properly', () => {
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

    expect(tableRows).toHaveLength(4);

    const firstRow = tableRows[1];

    const rowStatus = await findByTestId(firstRow, 'success-badge');
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
    expect(rowName).toBeInTheDocument();
    expect(rowDisplayName).toBeInTheDocument();
    expect(rowDescription).toBeInTheDocument();
  });

  it('Should render the parsed result properly with special character', async () => {
    const { container } = render(
      <ImportResult csvImportResult={mockCsvImportResult as CSVImportResult} />
    );

    const tableRows = getAllByRole(container, 'row');

    expect(tableRows).toHaveLength(4);

    const secondRow = tableRows[2];

    const rowStatus = await findByTestId(secondRow, 'success-badge');
    const rowDisplayName = await findByText(
      secondRow,
      'Glossary2 term2 displayname'
    );
    const rowName = await findByText(secondRow, 'Glossary2 term2');
    const rowDescription = await findByText(secondRow, 'Description, data.');
    const synonym = await findByText(secondRow, 'ter1,term2');

    expect(rowStatus).toBeInTheDocument();
    expect(rowName).toBeInTheDocument();
    expect(rowDisplayName).toBeInTheDocument();
    expect(rowDescription).toBeInTheDocument();
    expect(synonym).toBeInTheDocument();
  });

  it('Should render the parsed result even if its failed row', async () => {
    const { container } = render(
      <ImportResult csvImportResult={mockCsvImportResult as CSVImportResult} />
    );

    const tableRows = getAllByRole(container, 'row');

    expect(tableRows).toHaveLength(4);

    const thirdRow = tableRows[3];

    const rowStatus = await findByTestId(thirdRow, 'failure-badge');
    const errorMsg = await findByText(
      thirdRow,
      '#INVALID_FIELD: Field 6 error - Entity First Name not found'
    );
    const rowDisplayName = await findByText(
      thirdRow,
      'Glossary3 term3 displayname'
    );
    const rowName = await findByText(thirdRow, 'Glossary3 term3');
    const rowDescription = await findByText(thirdRow, 'Description2, data.');
    const synonym = await findByText(thirdRow, 'ter3,term4');

    expect(rowStatus).toBeInTheDocument();
    expect(errorMsg).toBeInTheDocument();
    expect(rowName).toBeInTheDocument();
    expect(rowDisplayName).toBeInTheDocument();
    expect(rowDescription).toBeInTheDocument();
    expect(synonym).toBeInTheDocument();
  });
});
