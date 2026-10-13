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
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../generated/entity/type';
import {
  getGlossaryTermAssets,
  removeAssetsFromGlossaryTerm,
} from '../../rest/glossaryAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  DATA_ASSET_PAGE_SIZE,
  OntologyConceptDataAssets,
} from './OntologyConceptDataAssets';

jest.mock('../../rest/glossaryAPI', () => ({
  getGlossaryTermAssets: jest.fn(),
  removeAssetsFromGlossaryTerm: jest.fn(),
}));

jest.mock('../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: { getServiceTypeLogo: jest.fn(() => '/service.svg') },
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../DataAssets/AssetsSelectionModal/AssetSelectionModal', () => ({
  AssetSelectionModal: ({
    entityFqn,
    onCancel,
    onSave,
  }: {
    entityFqn: string;
    onCancel: () => void;
    onSave: () => void;
  }) => (
    <div data-testid="asset-selection-modal">
      <span>{entityFqn}</span>
      <button type="button" onClick={onSave}>
        save-assets
      </button>
      <button type="button" onClick={onCancel}>
        cancel-assets
      </button>
    </div>
  ),
}));

const TERM_ID = '11111111-1111-1111-1111-111111111111';
const TERM: GlossaryTerm = {
  description: '',
  fullyQualifiedName: 'CustomerRetention.ChurnRate',
  glossary: { id: 'glossary-id', type: 'glossary' },
  id: TERM_ID,
  name: 'ChurnRate',
};

const asset = (index: number): EntityReference => ({
  id: `asset-${index}`,
  name: `table_${index}`,
  type: 'table',
});

const page = (from: number, count: number, total: number) => ({
  data: Array.from({ length: count }, (_, offset) => asset(from + offset)),
  paging: { total },
});

const mockGetAssets = getGlossaryTermAssets as jest.MockedFunction<
  typeof getGlossaryTermAssets
>;
const mockRemoveAssets = removeAssetsFromGlossaryTerm as jest.MockedFunction<
  typeof removeAssetsFromGlossaryTerm
>;

describe('OntologyConceptDataAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pages through the data assets inside the panel', async () => {
    mockGetAssets
      .mockResolvedValueOnce(page(0, DATA_ASSET_PAGE_SIZE, 12))
      .mockResolvedValueOnce(page(DATA_ASSET_PAGE_SIZE, 2, 12));

    render(
      <OntologyConceptDataAssets
        isEditMode={false}
        term={TERM}
        termId={TERM_ID}
      />
    );

    expect(await screen.findByText('table_0')).toBeInTheDocument();
    expect(screen.getByTestId('authoring-more-assets')).toHaveTextContent(
      '+2 label.more-lowercase label.data-asset-lowercase-plural'
    );

    fireEvent.click(screen.getByTestId('authoring-more-assets'));

    expect(await screen.findByText('table_11')).toBeInTheDocument();
    expect(mockGetAssets).toHaveBeenLastCalledWith(
      TERM_ID,
      DATA_ASSET_PAGE_SIZE,
      DATA_ASSET_PAGE_SIZE,
      undefined
    );
    expect(screen.getByText('table_0')).toBeInTheDocument();
    expect(
      screen.queryByTestId('authoring-more-assets')
    ).not.toBeInTheDocument();
  });

  it('keeps the list read-only outside Edit mode', async () => {
    mockGetAssets.mockResolvedValueOnce(page(0, 1, 1));

    render(
      <OntologyConceptDataAssets
        isEditMode={false}
        term={TERM}
        termId={TERM_ID}
      />
    );

    expect(await screen.findByText('table_0')).toBeInTheDocument();
    expect(
      screen.queryByTestId('authoring-add-data-assets')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('authoring-remove-asset-asset-0')
    ).not.toBeInTheDocument();
  });

  it('adds data assets through the asset picker and reloads the list', async () => {
    const onAssetsChange = jest.fn();
    mockGetAssets
      .mockResolvedValueOnce(page(0, 1, 1))
      .mockResolvedValueOnce(page(0, 2, 2));

    render(
      <OntologyConceptDataAssets
        isEditMode
        term={TERM}
        termId={TERM_ID}
        onAssetsChange={onAssetsChange}
      />
    );

    await screen.findByText('table_0');
    fireEvent.click(screen.getByTestId('authoring-add-data-assets'));

    expect(screen.getByTestId('asset-selection-modal')).toHaveTextContent(
      TERM.fullyQualifiedName ?? ''
    );

    fireEvent.click(screen.getByText('save-assets'));

    expect(await screen.findByText('table_1')).toBeInTheDocument();
    expect(
      screen.queryByTestId('asset-selection-modal')
    ).not.toBeInTheDocument();
    expect(mockGetAssets).toHaveBeenLastCalledWith(
      TERM_ID,
      DATA_ASSET_PAGE_SIZE,
      0,
      undefined
    );
    expect(onAssetsChange).toHaveBeenCalledTimes(1);
  });

  it('removes a data asset from the concept', async () => {
    const onAssetsChange = jest.fn();
    mockGetAssets
      .mockResolvedValueOnce(page(0, 2, 2))
      .mockResolvedValueOnce(page(1, 1, 1));
    mockRemoveAssets.mockResolvedValueOnce(TERM);

    render(
      <OntologyConceptDataAssets
        isEditMode
        term={TERM}
        termId={TERM_ID}
        onAssetsChange={onAssetsChange}
      />
    );

    await screen.findByText('table_0');
    fireEvent.click(screen.getByTestId('authoring-remove-asset-asset-0'));

    await waitFor(() =>
      expect(screen.queryByText('table_0')).not.toBeInTheDocument()
    );

    expect(mockRemoveAssets).toHaveBeenCalledWith(TERM, [
      { id: 'asset-0', type: 'table' },
    ]);
    expect(screen.getByText('table_1')).toBeInTheDocument();
    expect(onAssetsChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the asset and reports the error when removal fails', async () => {
    const onAssetsChange = jest.fn();
    const error = new Error('forbidden');
    mockGetAssets.mockResolvedValueOnce(page(0, 1, 1));
    mockRemoveAssets.mockRejectedValueOnce(error);

    render(
      <OntologyConceptDataAssets
        isEditMode
        term={TERM}
        termId={TERM_ID}
        onAssetsChange={onAssetsChange}
      />
    );

    await screen.findByText('table_0');
    fireEvent.click(screen.getByTestId('authoring-remove-asset-asset-0'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(screen.getByText('table_0')).toBeInTheDocument();
    expect(onAssetsChange).not.toHaveBeenCalled();
  });
});
