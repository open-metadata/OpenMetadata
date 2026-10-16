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
import { SearchIndex } from '../../enums/search.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  BulkOperationResult,
  Status,
} from '../../generated/type/bulkOperationResult';
import { addAssetsToGlossaryTerm } from '../../rest/glossaryAPI';
import { searchQuery } from '../../rest/searchAPI';
import OntologyDataAssetPicker from './OntologyDataAssetPicker';

jest.mock('../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));
jest.mock('../../rest/glossaryAPI', () => ({
  addAssetsToGlossaryTerm: jest.fn(),
}));
jest.mock('../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));

const mockSearch = searchQuery as jest.MockedFunction<typeof searchQuery>;
const mockAddAssets = addAssetsToGlossaryTerm as jest.MockedFunction<
  typeof addAssetsToGlossaryTerm
>;

const TERM = {
  fullyQualifiedName: 'BankingCore.Account',
  id: 'term-1',
  name: 'Account',
} as GlossaryTerm;

const hit = (id: string, name: string, entityType: string) => ({
  _source: {
    entityType,
    fullyQualifiedName: `svc.db.sch.${name}`,
    id,
    name,
  },
});

describe('OntologyDataAssetPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch.mockResolvedValue({
      hits: {
        hits: [hit('t-1', 'customers', 'table'), hit('t-2', 'orders', 'table')],
        total: { value: 2 },
      },
    } as never);
    mockAddAssets.mockResolvedValue({
      status: Status.Success,
    } as BulkOperationResult);
  });

  it('searches tables and columns, then narrows to columns', async () => {
    render(
      <OntologyDataAssetPicker
        term={TERM}
        onCancel={jest.fn()}
        onPartialSave={jest.fn()}
        onSave={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(mockSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          searchIndex: [SearchIndex.TABLE, SearchIndex.COLUMN],
        })
      )
    );

    expect(
      await screen.findByTestId('ontology-data-asset-option-t-1')
    ).toHaveTextContent('svc / db / sch');

    fireEvent.click(screen.getByRole('tab', { name: 'label.column-plural' }));

    await waitFor(() =>
      expect(mockSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchIndex: [SearchIndex.COLUMN] })
      )
    );
  });

  it('adds every selected asset to the concept', async () => {
    const onSave = jest.fn();
    render(
      <OntologyDataAssetPicker
        term={TERM}
        onCancel={jest.fn()}
        onPartialSave={jest.fn()}
        onSave={onSave}
      />
    );

    await screen.findByTestId('ontology-data-asset-option-t-1');

    expect(screen.getByTestId('ontology-data-asset-save')).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'label.select-all' }));
    fireEvent.click(screen.getByTestId('ontology-data-asset-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalled());

    expect(mockAddAssets).toHaveBeenCalledWith(TERM, [
      expect.objectContaining({
        fullyQualifiedName: 'svc.db.sch.customers',
        id: 't-1',
        type: 'table',
      }),
      expect.objectContaining({ id: 't-2', type: 'table' }),
    ]);
  });

  it('keeps refused assets selected with the reason and refreshes for the rest', async () => {
    mockAddAssets.mockResolvedValue({
      failedRequest: [
        { message: 'Tag conflict', request: { id: 't-2', type: 'table' } },
      ],
      status: Status.PartialSuccess,
    } as BulkOperationResult);
    const onSave = jest.fn();
    const onPartialSave = jest.fn();
    render(
      <OntologyDataAssetPicker
        term={TERM}
        onCancel={jest.fn()}
        onPartialSave={onPartialSave}
        onSave={onSave}
      />
    );
    await screen.findByTestId('ontology-data-asset-option-t-1');

    fireEvent.click(screen.getByRole('checkbox', { name: 'label.select-all' }));
    fireEvent.click(screen.getByTestId('ontology-data-asset-save'));

    expect(
      await screen.findByTestId('ontology-data-asset-error-t-2')
    ).toHaveTextContent('Tag conflict');
    expect(onPartialSave).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'orders' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'customers' })
    ).not.toBeChecked();
  });

  it('loads the next page of matches on demand', async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        hits: [hit('t-1', 'customers', 'table')],
        total: { value: 2 },
      },
    } as never);
    mockSearch.mockResolvedValueOnce({
      hits: { hits: [hit('t-2', 'orders', 'table')], total: { value: 2 } },
    } as never);
    render(
      <OntologyDataAssetPicker
        term={TERM}
        onCancel={jest.fn()}
        onPartialSave={jest.fn()}
        onSave={jest.fn()}
      />
    );

    fireEvent.click(await screen.findByTestId('ontology-data-asset-load-more'));

    expect(
      await screen.findByTestId('ontology-data-asset-option-t-2')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('ontology-data-asset-option-t-1')
    ).toBeInTheDocument();
    expect(mockSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 2 })
    );
    expect(
      screen.queryByTestId('ontology-data-asset-load-more')
    ).not.toBeInTheDocument();
  });
});
