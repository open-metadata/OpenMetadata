/*
 *  Copyright 2021 Collate
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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { DBTLocalConfig } from './DBTLocalConfig';

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockCatalogChange = jest.fn();
const mockManifestChange = jest.fn();

const mockProps = {
  dbtCatalogFilePath: '',
  dbtManifestFilePath: '',
  okText: 'Next',
  cancelText: 'Back',
  onCancel: mockCancel,
  onSubmit: mockSubmit,
  handleCatalogFilePathChange: mockCatalogChange,
  handleManifestFilePathChange: mockManifestChange,
};

describe('Test DBT Local Config Form', () => {
  it('Fields should render', async () => {
    const { container } = render(<DBTLocalConfig {...mockProps} />);
    const inputCatalog = getByTestId(container, 'catalog-file');
    const inputManifest = getByTestId(container, 'manifest-file');

    expect(inputCatalog).toBeInTheDocument();
    expect(inputManifest).toBeInTheDocument();
  });

  it('catalog should render data', async () => {
    const { container } = render(
      <DBTLocalConfig {...mockProps} dbtCatalogFilePath="CatalogFile" />
    );
    const inputCatalog = getByTestId(container, 'catalog-file');

    expect(inputCatalog).toHaveValue('CatalogFile');
  });

  it('manifest should render data', async () => {
    const { container } = render(
      <DBTLocalConfig {...mockProps} dbtManifestFilePath="ManifestFile" />
    );
    const inputManifest = getByTestId(container, 'manifest-file');

    expect(inputManifest).toHaveValue('ManifestFile');
  });

  it('catalog should change', async () => {
    const { container } = render(<DBTLocalConfig {...mockProps} />);
    const inputCatalog = getByTestId(container, 'catalog-file');

    fireEvent.change(inputCatalog, {
      target: {
        value: 'Catalog File',
      },
    });

    expect(mockCatalogChange).toBeCalled();
  });

  it('manifest should change', async () => {
    const { container } = render(<DBTLocalConfig {...mockProps} />);
    const inputManifest = getByTestId(container, 'manifest-file');

    fireEvent.change(inputManifest, {
      target: {
        value: 'Manifest File',
      },
    });

    expect(mockManifestChange).toBeCalled();
  });

  it('should show errors on submit', async () => {
    const { container } = render(<DBTLocalConfig {...mockProps} />);
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).not.toBeCalled();
  });

  it('should submit', async () => {
    const { container } = render(
      <DBTLocalConfig
        {...mockProps}
        dbtCatalogFilePath="CatalogFile"
        dbtManifestFilePath="ManifestFile"
      />
    );
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).toBeCalled();
  });

  it('should cancel', async () => {
    const { container } = render(<DBTLocalConfig {...mockProps} />);
    const backBtn = getByTestId(container, 'back-button');

    fireEvent.click(backBtn);

    expect(mockCancel).toBeCalled();
  });
});
