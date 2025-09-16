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
import { render, screen } from '@testing-library/react';
import { CSVImportResult } from '../../../../generated/type/csvImportResult';
import { ImportStatus } from './ImportStatus.component';

const mockCsvImportResult = {
  dryRun: true,
  status: 'success',
  numberOfRowsProcessed: 3,
  numberOfRowsPassed: 3,
  numberOfRowsFailed: 0,
  importResultsCsv: `status,details,parent,name*,displayName,description,synonyms,relatedTerms,references,tags\r
  success,Entity created,,Glossary2 Term,Glossary2 Term displayName,Description for Glossary2 Term,,,,\r
  success,Entity created,,Glossary2 term2,Glossary2 term2,Description data.,,,,\r`,
};

describe('ImportStatus component', () => {
  it('Component should render', async () => {
    render(
      <ImportStatus csvImportResult={mockCsvImportResult as CSVImportResult} />
    );

    const processed = await screen.findByTestId('processed-row');
    const pass = await screen.findByTestId('passed-row');
    const failed = await screen.findByTestId('failed-row');

    expect(
      await screen.findByText('label.number-of-rows:')
    ).toBeInTheDocument();
    expect(processed.textContent).toStrictEqual(
      `${mockCsvImportResult.numberOfRowsProcessed}`
    );
    expect(await screen.findByText('label.passed:')).toBeInTheDocument();
    expect(pass.textContent).toStrictEqual(
      `${mockCsvImportResult.numberOfRowsPassed}`
    );
    expect(await screen.findByText('label.failed:')).toBeInTheDocument();
    expect(failed.textContent).toStrictEqual(
      `${mockCsvImportResult.numberOfRowsFailed}`
    );
  });
});
