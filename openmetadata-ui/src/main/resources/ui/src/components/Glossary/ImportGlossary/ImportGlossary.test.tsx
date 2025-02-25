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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { CSVImportResult } from '../../../generated/type/csvImportResult';
import { importGlossaryInCSVFormat } from '../../../rest/glossaryAPI';
import ImportGlossary from './ImportGlossary';

const mockPush = jest.fn();
const glossaryName = 'Glossary1';
const mockCsvImportResult = {
  dryRun: true,
  status: 'success',
  numberOfRowsProcessed: 3,
  numberOfRowsPassed: 3,
  numberOfRowsFailed: 0,
  importResultsCsv: `status,details,parent,name*,displayName,description,synonyms,relatedTerms,references,tags\r
  success,Entity created,,Glossary2 Term,Glossary2 Term displayName,Description for Glossary2 Term,,,,\r
  success,Entity created,,Glossary2 term2,Glossary2 term2,Description data.,,,,\r`,
} as CSVImportResult;

jest.mock('../../common/TitleBreadcrumb/TitleBreadcrumb.component', () =>
  jest.fn().mockReturnValue(<div data-testid="breadcrumb">Breadcrumb</div>)
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <p>{children}</p>);
});

jest.mock('../../BulkImport/BulkEntityImport.component', () =>
  jest.fn().mockImplementation(({ onSuccess, onValidateCsvString }) => (
    <div>
      <button onClick={onSuccess}>SuccessButton</button>
      <button
        onClick={() => onValidateCsvString('markdown: This is test', true)}>
        ValidateCsvButton
      </button>
      <p>BulkEntityImport</p>
    </div>
  ))
);

jest.mock('../../../rest/glossaryAPI', () => ({
  importGlossaryInCSVFormat: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockCsvImportResult)),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getGlossaryPath: jest.fn().mockImplementation((fqn) => `/glossary/${fqn}`),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
jest.mock('../../common/EntityImport/EntityImport.component', () => ({
  EntityImport: jest.fn().mockImplementation(({ children, onImport }) => {
    return (
      <div data-testid="entity-import">
        {children}{' '}
        <button data-testid="import" onClick={onImport}>
          import
        </button>
      </div>
    );
  }),
}));

describe('Import Glossary', () => {
  it('Should render the all components', async () => {
    render(<ImportGlossary glossaryName={glossaryName} />);

    expect(await screen.findByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByText('BulkEntityImport')).toBeInTheDocument();
    expect(screen.getByText('SuccessButton')).toBeInTheDocument();
    expect(screen.getByText('ValidateCsvButton')).toBeInTheDocument();
  });

  it('should redirect the page when onSuccess get triggered', async () => {
    render(<ImportGlossary glossaryName={glossaryName} />);

    const successButton = screen.getByText('SuccessButton');
    await act(async () => {
      fireEvent.click(successButton);
    });

    expect(mockPush).toHaveBeenCalled();
  });

  it('should call the importGlossaryInCSVFormat api when validate props is trigger', async () => {
    render(<ImportGlossary glossaryName={glossaryName} />);

    const successButton = screen.getByText('ValidateCsvButton');
    await act(async () => {
      fireEvent.click(successButton);
    });

    expect(importGlossaryInCSVFormat).toHaveBeenCalledWith(
      'Glossary1',
      'markdown: This is test',
      true
    );
  });
});
