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
import { showErrorToast } from '../../utils/ToastUtils';
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
    // Drop queued one-off responses a failed test may have left behind.
    mockSearch.mockReset();
    mockAddAssets.mockReset();
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

  it('saves native associations without glossary tagging and excludes linked assets from select all', async () => {
    const saveAssets = jest.fn().mockResolvedValue({ failedRequest: [] });
    render(
      <OntologyDataAssetPicker
        native={{ assetTypes: ['table'], linkedIds: ['t-1'], saveAssets }}
        onCancel={jest.fn()}
        onPartialSave={jest.fn()}
        onSave={jest.fn()}
      />
    );
    await screen.findByText('customers');
    fireEvent.click(screen.getByRole('checkbox', { name: 'label.select-all' }));
    fireEvent.click(screen.getByTestId('ontology-data-asset-save'));
    await waitFor(() =>
      expect(saveAssets).toHaveBeenCalledWith([
        expect.objectContaining({ id: 't-2', type: 'table' }),
      ])
    );

    expect(mockAddAssets).not.toHaveBeenCalled();
  });

  it('searches every data asset, then narrows to columns', async () => {
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
          searchIndex: SearchIndex.DATA_ASSET,
        })
      )
    );

    expect(
      await screen.findByTestId('ontology-data-asset-option-t-1')
    ).toHaveTextContent('svc / db / sch');

    fireEvent.click(screen.getByRole('tab', { name: 'label.column-plural' }));

    await waitFor(() =>
      expect(mockSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchIndex: SearchIndex.COLUMN })
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

  it('asks for each page once and retries a page that failed', async () => {
    mockSearch
      .mockResolvedValueOnce({
        hits: { hits: [hit('t-1', 'customers', 'table')], total: { value: 2 } },
      } as never)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
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
    const loadMore = await screen.findByTestId('ontology-data-asset-load-more');

    fireEvent.click(loadMore);
    fireEvent.click(loadMore);

    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));

    expect(mockSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 2 })
    );

    await waitFor(() => expect(loadMore).toBeEnabled());
    fireEvent.click(loadMore);

    expect(
      await screen.findByTestId('ontology-data-asset-option-t-2')
    ).toBeInTheDocument();
    expect(
      mockSearch.mock.calls.map(([request]) => request.pageNumber)
    ).toEqual([1, 2, 2]);
  });

  it('starts a changed search from its first page, even after that page failed', async () => {
    mockSearch
      .mockResolvedValueOnce({
        hits: { hits: [hit('t-1', 'customers', 'table')], total: { value: 3 } },
      } as never)
      .mockResolvedValueOnce({
        hits: { hits: [hit('t-2', 'orders', 'table')], total: { value: 3 } },
      } as never)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        hits: { hits: [hit('t-9', 'invoices', 'table')], total: { value: 1 } },
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
    await screen.findByTestId('ontology-data-asset-option-t-2');

    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'message.search-tables-and-columns',
      }),
      { target: { value: 'inv' } }
    );
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(3));

    // The old search's rows are gone at once, and the failed page is offered
    // again.
    expect(
      screen.queryByTestId('ontology-data-asset-option-t-1')
    ).not.toBeInTheDocument();

    const retry = await screen.findByTestId('ontology-data-asset-load-more');

    expect(retry).toHaveTextContent('label.retry');

    fireEvent.click(retry);

    expect(
      await screen.findByTestId('ontology-data-asset-option-t-9')
    ).toBeInTheDocument();
    expect(mockSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 1, query: '*inv*' })
    );
    expect(
      screen.queryByTestId('ontology-data-asset-option-t-1')
    ).not.toBeInTheDocument();
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

  it('says when nothing matches', async () => {
    mockSearch.mockResolvedValue({
      hits: { hits: [], total: { value: 0 } },
    } as never);
    render(
      <OntologyDataAssetPicker
        term={TERM}
        onCancel={jest.fn()}
        onPartialSave={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('ontology-data-asset-empty')
    ).toHaveTextContent('label.no-data-found');
  });

  it('reports a refused asset that is not in the current search, and counts the selection', async () => {
    mockAddAssets.mockResolvedValue({
      failedRequest: [
        {
          message: 'No edit access',
          request: { id: 'elsewhere', type: 'table' },
        },
      ],
      status: Status.Failure,
    } as BulkOperationResult);
    render(
      <OntologyDataAssetPicker
        term={TERM}
        onCancel={jest.fn()}
        onPartialSave={jest.fn()}
        onSave={jest.fn()}
      />
    );
    await screen.findByTestId('ontology-data-asset-option-t-1');
    fireEvent.click(screen.getByRole('checkbox', { name: 'label.select-all' }));

    expect(
      screen.getByTestId('ontology-data-asset-selected-count')
    ).toHaveTextContent('label.n-selected');

    fireEvent.click(screen.getByTestId('ontology-data-asset-save'));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('No edit access')
    );
  });
});
