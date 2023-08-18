/*
 *  Copyright 2022 Collate.
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
import { dbtParsingTimeoutLimit } from './DBTFormConstants';
import { DBTLocalConfig } from './DBTLocalConfig';

const mockProps = {
  dbtCatalogFilePath: '',
  dbtManifestFilePath: '',
  dbtRunResultsFilePath: '',
  dbtUpdateDescriptions: false,
  enableDebugLog: false,
  parsingTimeoutLimit: dbtParsingTimeoutLimit,
};

jest.mock('./DBTCommonFields.component', () =>
  jest.fn().mockImplementation(() => <div>DBT Common Fields</div>)
);

describe('Test DBT Local Config Form Fields', () => {
  it('Should render the form fields', async () => {
    render(<DBTLocalConfig {...mockProps} />);
    const catalogFileField = screen.getByTestId('catalog-file');
    const manifestFileField = screen.getByTestId('manifest-file');
    const runResultFileField = screen.getByTestId('run-result-file');

    expect(catalogFileField).toBeInTheDocument();
    expect(manifestFileField).toBeInTheDocument();
    expect(runResultFileField).toBeInTheDocument();
  });

  it('Should have value on change', async () => {
    render(
      <DBTLocalConfig
        {...mockProps}
        dbtCatalogFilePath="catalog-file"
        dbtManifestFilePath="manifest"
        dbtRunResultsFilePath="run-result"
      />
    );
    const catalogFileField = screen.getByTestId('catalog-file');
    const manifestFileField = screen.getByTestId('manifest-file');
    const runResultFileField = screen.getByTestId('run-result-file');

    act(() => {
      fireEvent.change(catalogFileField, {
        target: { value: 'catalog-file-path' },
      });
      fireEvent.change(manifestFileField, {
        target: { value: 'manifest-file-path' },
      });
      fireEvent.change(runResultFileField, {
        target: { value: 'run-result-file-path' },
      });
    });

    expect(catalogFileField).toHaveValue('catalog-file-path');
    expect(manifestFileField).toHaveValue('manifest-file-path');
    expect(runResultFileField).toHaveValue('run-result-file-path');
  });
});
