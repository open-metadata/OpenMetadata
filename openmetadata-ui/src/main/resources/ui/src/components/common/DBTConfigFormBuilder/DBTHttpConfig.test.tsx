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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { DBTHttpConfig } from './DBTHttpConfig';

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockCatalogChange = jest.fn();
const mockManifestChange = jest.fn();
const mockRunResultsHttpPathChange = jest.fn();
const mockUpdateDescriptions = jest.fn();
const mockIncludeTagsClick = jest.fn();
const mockUpdateDBTClassification = jest.fn();
const mockHandleEnableDebugLogCheck = jest.fn();

jest.mock('./DBTCommonFields.component', () =>
  jest.fn().mockImplementation(() => <div>DBT Common Fields</div>)
);

const mockProps = {
  dbtCatalogHttpPath: '',
  dbtManifestHttpPath: '',
  dbtRunResultsHttpPath: '',
  dbtUpdateDescriptions: false,
  okText: 'Next',
  cancelText: 'Back',
  onCancel: mockCancel,
  onSubmit: mockSubmit,
  handleCatalogHttpPathChange: mockCatalogChange,
  handleManifestHttpPathChange: mockManifestChange,
  handleRunResultsHttpPathChange: mockRunResultsHttpPathChange,
  handleUpdateDescriptions: mockUpdateDescriptions,
  handleIncludeTagsClick: mockIncludeTagsClick,
  handleUpdateDBTClassification: mockUpdateDBTClassification,
  enableDebugLog: false,
  handleEnableDebugLogCheck: mockHandleEnableDebugLogCheck,
};

describe('Test DBT Http Config Form', () => {
  it('Fields should render', async () => {
    const { container } = render(<DBTHttpConfig {...mockProps} />);
    const inputCatalog = getByTestId(container, 'catalog-url');
    const inputManifest = getByTestId(container, 'manifest-url');

    expect(inputCatalog).toBeInTheDocument();
    expect(inputManifest).toBeInTheDocument();
  });

  it('catalog should render data', async () => {
    const { container } = render(
      <DBTHttpConfig {...mockProps} dbtCatalogHttpPath="CatalogUrl" />
    );
    const inputCatalog = getByTestId(container, 'catalog-url');

    expect(inputCatalog).toHaveValue('CatalogUrl');
  });

  it('manifest should render data', async () => {
    const { container } = render(
      <DBTHttpConfig {...mockProps} dbtManifestHttpPath="ManifestUrl" />
    );
    const inputManifest = getByTestId(container, 'manifest-url');

    expect(inputManifest).toHaveValue('ManifestUrl');
  });

  it('catalog should change', async () => {
    const { container } = render(<DBTHttpConfig {...mockProps} />);
    const inputCatalog = getByTestId(container, 'catalog-url');

    fireEvent.change(inputCatalog, {
      target: {
        value: 'Catalog Url',
      },
    });

    expect(mockCatalogChange).toHaveBeenCalled();
  });

  it('manifest should change', async () => {
    const { container } = render(<DBTHttpConfig {...mockProps} />);
    const inputManifest = getByTestId(container, 'manifest-url');

    fireEvent.change(inputManifest, {
      target: {
        value: 'Manifest Url',
      },
    });

    expect(mockManifestChange).toHaveBeenCalled();
  });

  it('should show errors on submit', async () => {
    const { container } = render(<DBTHttpConfig {...mockProps} />);
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('should submit', async () => {
    const { container } = render(
      <DBTHttpConfig
        {...mockProps}
        dbtCatalogHttpPath="CatalogUrl"
        dbtManifestHttpPath="ManifestUrl"
      />
    );
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).toHaveBeenCalled();
  });

  it('should cancel', async () => {
    const { container } = render(<DBTHttpConfig {...mockProps} />);
    const backBtn = getByTestId(container, 'back-button');

    fireEvent.click(backBtn);

    expect(mockCancel).toHaveBeenCalled();
  });
});
