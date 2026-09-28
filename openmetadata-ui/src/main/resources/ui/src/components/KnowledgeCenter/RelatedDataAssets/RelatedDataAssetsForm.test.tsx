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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { RelatedDataAssetsForm } from './RelatedDataAssetsForm';
jest.mock(
  '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList',
  () => jest.fn(() => <div data-testid="DataAssetSelectList" />)
);

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockInitialOptions: DataAssetOption[] = [];

describe('RelatedDataAssetsForm', () => {
  it('should render', () => {
    render(
      <RelatedDataAssetsForm
        initialOptions={mockInitialOptions}
        onCancel={mockCancel}
        onSubmit={mockSubmit}
      />
    );

    expect(screen.getByTestId('DataAssetSelectList')).toBeInTheDocument();
    expect(screen.getByTestId('cancelDataAssets')).toBeInTheDocument();
    expect(screen.getByTestId('saveDataAssets')).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <RelatedDataAssetsForm
        initialOptions={mockInitialOptions}
        onCancel={mockCancel}
        onSubmit={mockSubmit}
      />
    );
    fireEvent.click(screen.getByTestId('cancelDataAssets'));

    expect(mockCancel).toHaveBeenCalled();
  });

  it('should call onSubmit when save button is clicked', async () => {
    render(
      <RelatedDataAssetsForm
        initialOptions={mockInitialOptions}
        onCancel={mockCancel}
        onSubmit={mockSubmit}
      />
    );
    fireEvent.click(screen.getByTestId('saveDataAssets'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
    });
  });
});
