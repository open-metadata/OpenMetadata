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
import { findAllByRole, render, screen } from '@testing-library/react';
import { CSVImportResult } from '../../../../generated/type/csvImportResult';
import { UserImportResult } from './UserImportResult.component';

const mockCsvImportResult = {
  dryRun: true,
  status: 'success',
  numberOfRowsProcessed: 3,
  numberOfRowsPassed: 3,
  numberOfRowsFailed: 0,
  importResultsCsv:
    // eslint-disable-next-line max-len
    'status,details,name*,displayName,description,email*,timezone,isAdmin,teams*,Roles\r\nsuccess,Entity updated,aaron_johnson0,Aaron Johnson,,aaron_johnson0@gmail.com,,false,Applications,DataSteward\r\nsuccess,Entity updated,aaron_singh2,Aaron Singh,,aaron_singh2@gmail.com,,false,Applications,\r\nfailure,,,,,,,,,,',
} as CSVImportResult;

describe('UserImportResult component', () => {
  it('Component should render', async () => {
    render(<UserImportResult csvImportResult={mockCsvImportResult} />);
    const table = await screen.findByRole('table');
    const row = await findAllByRole(table, 'row');

    expect(
      await screen.findByTestId('import-result-table')
    ).toBeInTheDocument();
    expect(row).toHaveLength(4);
  });

  it('Component should render id no data provided', async () => {
    render(
      <UserImportResult csvImportResult={{ importResultsCsv: undefined }} />
    );

    expect(
      await screen.findByTestId('import-result-table')
    ).toBeInTheDocument();
  });
});
