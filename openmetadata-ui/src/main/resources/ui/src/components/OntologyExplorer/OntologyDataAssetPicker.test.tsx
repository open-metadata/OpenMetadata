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
import { Dialog, Modal, ModalOverlay } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { SearchIndex } from '../../enums/search.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  BulkOperationResult,
  Status,
} from '../../generated/type/bulkOperationResult';
import { useIsAiMode } from '../../hooks/useAppMode';
import { addAssetsToGlossaryTerm } from '../../rest/glossaryAPI';
import { searchQuery } from '../../rest/searchAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import OntologyDataAssetPicker from './OntologyDataAssetPicker';

jest.mock('../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));
jest.mock('../../rest/glossaryAPI', () => ({
  addAssetsToGlossaryTerm: jest.fn(),
}));
jest.mock('../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));
jest.mock('../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

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
    const saveAssets = jest.fn().mockResolvedValue({
      completedIds: ['t-2'],
      remaining: [],
      stop: 'none',
    });
    render(
      <OntologyDataAssetPicker
        native={{
          assetTypes: ['table'],
          linkedIds: ['t-1'],
          isDisabled: false,
          saveAssets,
        }}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />
    );
    await screen.findByText('customers');
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'label.select-all-lowercase' })
    );
    fireEvent.click(screen.getByTestId('ontology-data-asset-save'));
    await waitFor(() =>
      expect(saveAssets).toHaveBeenCalledWith([
        expect.objectContaining({ id: 't-2', type: 'table' }),
      ])
    );

    expect(mockAddAssets).not.toHaveBeenCalled();
  });

  it('offers the service of a suggested asset even when the plain list omits it', async () => {
    const withService = (id: string, name: string, service: string) => ({
      _source: {
        ...hit(id, name, 'table')._source,
        service: { name: service },
      },
    });
    mockSearch.mockImplementation(async ({ query }) => {
      const isSuggestion = String(query).includes('*Prescription*');

      return {
        hits: {
          hits: isSuggestion
            ? [withService('t-rx', 'prescription_orders', 'svc-pharmacy')]
            : [withService('t-1', 'customers', 'svc-sales')],
          total: { value: 1 },
        },
      } as never;
    });
    render(
      <OntologyDataAssetPicker
        native={{
          assetTypes: ['table'],
          concept: { name: 'Prescription' },
          linkedIds: [],
          isDisabled: false,
          saveAssets: jest.fn(),
        }}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />
    );
    await screen.findByTestId('ontology-data-asset-suggested-heading');
    fireEvent.click(screen.getByRole('button', { name: /label\.service/ }));

    expect(
      await screen.findByRole('option', { name: 'svc-pharmacy' })
    ).toBeVisible();
    expect(screen.getByRole('option', { name: 'svc-sales' })).toBeVisible();
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

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'label.select-all-lowercase' })
    );
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

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'label.select-all-lowercase' })
    );
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
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'label.select-all-lowercase' })
    );

    expect(
      screen.getByTestId('ontology-data-asset-selected-count')
    ).toHaveTextContent('label.n-selected-lowercase');

    fireEvent.click(screen.getByTestId('ontology-data-asset-save'));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('No edit access')
    );
  });

  it('selects, saves and cancels in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const saveAssets = jest.fn().mockResolvedValue({
      completedIds: ['t-2'],
      remaining: [],
      stop: 'none',
    });
    const onSave = jest.fn();
    const onCancel = jest.fn();
    render(
      <OntologyDataAssetPicker
        native={{
          assetTypes: ['table'],
          linkedIds: ['t-1'],
          isDisabled: false,
          saveAssets,
        }}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
    await screen.findByText('orders');

    expect(
      screen.getByTestId('ontology-data-asset-option-t-1')
    ).toHaveAttribute('data-disabled');

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'label.select-all-lowercase' })
    );

    expect(
      screen.getByTestId('ontology-data-asset-selected-count')
    ).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-data-asset-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    expect(saveAssets).toHaveBeenCalledWith([
      expect.objectContaining({ id: 't-2' }),
    ]);

    fireEvent.click(screen.getByTestId('ontology-data-asset-picker-close'));

    expect(onCancel).toHaveBeenCalled();

    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  describe('linking assets to a concept', () => {
    const renderNative = (overrides: Partial<{ linkedIds: string[] }> = {}) =>
      render(
        <OntologyDataAssetPicker
          native={{
            assetTypes: ['table', 'topic'],
            concept: { name: 'Medication Record', synonyms: ['Rx'] },
            isDisabled: false,
            linkedIds: [],
            saveAssets: jest.fn(),
            ...overrides,
          }}
          onCancel={jest.fn()}
          onSave={jest.fn()}
        />
      );

    const withColumns = (id: string, name: string, columns: string[]) => ({
      _source: {
        ...hit(id, name, 'table')._source,
        columns: columns.map((column) => ({ name: column })),
      },
    });

    beforeEach(() => {
      mockSearch.mockImplementation(async ({ query }) => {
        const isSuggestion = String(query).includes(' OR ');
        const hits = isSuggestion
          ? [
              withColumns('t-3', 'medication_events', ['id']),
              withColumns('t-4', 'events', ['id', 'record_id']),
              withColumns('t-5', 'rx_orders', []),
            ]
          : [
              withColumns('t-1', 'customers', []),
              withColumns('t-3', 'medication_events', ['id']),
            ];

        return { hits: { hits, total: { value: hits.length } } } as never;
      });
    });

    it('puts assets that resemble the concept first, each with the reason', async () => {
      renderNative();

      expect(
        await screen.findByTestId('ontology-data-asset-reason-t-3')
      ).toHaveTextContent('message.ontology-suggest-name');
      expect(
        screen.getByTestId('ontology-data-asset-reason-t-4')
      ).toHaveTextContent('message.ontology-suggest-column');
      expect(
        screen.getByTestId('ontology-data-asset-reason-t-5')
      ).toHaveTextContent('message.ontology-suggest-synonym');
      expect(
        screen.getByTestId('ontology-data-asset-suggested-heading')
      ).toBeVisible();
      expect(
        screen.getAllByRole('checkbox', { name: 'medication_events' })
      ).toHaveLength(1);

      const labels = screen
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('aria-label'));

      expect(labels.indexOf('medication_events')).toBeLessThan(
        labels.indexOf('customers')
      );
    });

    it('keeps an already linked asset out of Suggested', async () => {
      renderNative({ linkedIds: ['t-3'] });

      expect(
        await screen.findByTestId('ontology-data-asset-reason-t-4')
      ).toBeVisible();
      expect(
        screen.queryByTestId('ontology-data-asset-reason-t-3')
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'medication_events' })
      ).toBeChecked();
    });

    it('shows the list once, after suggestions arrive, instead of reordering it', async () => {
      let release: () => void = () => undefined;
      const arrival = new Promise<void>((resolve) => {
        release = resolve;
      });
      const base = mockSearch.getMockImplementation();
      mockSearch.mockImplementation(async (request) => {
        if (String(request.query).includes(' OR ')) {
          await arrival;
        }

        return base?.(request) as never;
      });
      renderNative();

      expect(
        await screen.findByTestId('ontology-data-asset-loading')
      ).toBeVisible();
      expect(
        screen.queryByRole('checkbox', { name: 'customers' })
      ).not.toBeInTheDocument();

      await act(async () => release());

      expect(
        await screen.findByTestId('ontology-data-asset-suggested-heading')
      ).toBeVisible();
      expect(
        screen.queryByTestId('ontology-data-asset-loading')
      ).not.toBeInTheDocument();
    });

    it('stops suggesting once a search narrows the list', async () => {
      renderNative();
      await screen.findByTestId('ontology-data-asset-reason-t-3');

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'cust' },
      });

      await waitFor(() =>
        expect(
          screen.queryByTestId('ontology-data-asset-reason-t-3')
        ).not.toBeInTheDocument()
      );
    });

    it('narrows the search to one asset type from the filter', async () => {
      renderNative();
      await screen.findByText('customers');

      fireEvent.click(screen.getByRole('button', { name: /label\.type/ }));
      fireEvent.click(await screen.findByRole('option', { name: /topic/i }));

      await waitFor(() =>
        expect(mockSearch.mock.calls.at(-1)?.[0].queryFilter).toEqual({
          query: { bool: { must: [{ terms: { entityType: ['topic'] } }] } },
        })
      );
    });

    it('says why a linked row cannot be picked', async () => {
      renderNative({ linkedIds: ['t-1'] });

      const box = await screen.findByRole('checkbox', { name: 'customers' });

      expect(box).toBeDisabled();
      expect(box).toBeChecked();
      expect(
        screen.getByTestId('ontology-data-asset-linked-t-1')
      ).toHaveTextContent('message.ontology-asset-already-linked');
      expect(
        screen.queryByTestId('ontology-data-asset-linked-t-2')
      ).not.toBeInTheDocument();
    });

    it('states that a linked asset is already linked exactly once', async () => {
      renderNative({ linkedIds: ['t-1'] });

      await screen.findByRole('checkbox', { name: 'customers' });

      expect(
        screen.getAllByText('message.ontology-asset-already-linked')
      ).toHaveLength(1);
    });
  });

  describe('as the Link data dialog', () => {
    const richHit = {
      _source: {
        ...hit('t-1', 'prescriptions', 'table')._source,
        domains: [
          { id: 'd-1', fullyQualifiedName: 'Clinical', name: 'Clinical' },
        ],
        owners: [{ id: 'u-1', name: 'priya', displayName: 'Priya Raman' }],
        service: { name: 'bq_clinical', displayName: 'BigQuery' },
        tags: [{ tagFQN: 'Tier.Tier1' }],
      },
    };
    const lastFilter = () =>
      JSON.stringify(mockSearch.mock.calls.at(-1)?.[0].queryFilter);
    const pick = async (filter: RegExp, option: string) => {
      fireEvent.click(screen.getByRole('button', { name: filter }));
      fireEvent.click(await screen.findByRole('option', { name: option }));
    };

    beforeEach(() => {
      mockSearch.mockResolvedValue({
        hits: { hits: [richHit], total: { value: 12 } },
      } as never);
      render(
        <ModalOverlay isOpen>
          <Modal>
            <Dialog aria-label="link" dividers="scroll" width={880}>
              <OntologyDataAssetPicker
                native={{
                  assetTypes: ['table', 'topic'],
                  concept: { name: 'Medication Record' },
                  isDialog: true,
                  isDisabled: false,
                  linkedIds: [],
                  saveAssets: jest.fn(),
                }}
                onCancel={jest.fn()}
                onSave={jest.fn()}
              />
            </Dialog>
          </Modal>
        </ModalOverlay>
      );
    });

    it('names the concept, counts the catalog, and shows each row with its source, type and tier', async () => {
      await screen.findByText('prescriptions');

      expect(screen.getByText('label.link-data-to-entity')).toBeInTheDocument();
      expect(screen.getByTestId('ontology-data-asset-total')).toHaveTextContent(
        'label.count-asset-in-catalog'
      );
      expect(screen.getByText('BigQuery')).toBeInTheDocument();
      expect(
        screen.getByTestId('ontology-data-asset-tier-t-1')
      ).toHaveTextContent('Tier1');
      expect(screen.getByTestId('ontology-data-asset-save')).toHaveTextContent(
        'label.select-asset-plural'
      );
      expect(
        screen.getByText('message.ontology-link-applies-now')
      ).toBeInTheDocument();
    });

    it('orders the filters Service, Type, Domain, Owner', async () => {
      await screen.findByText('prescriptions');

      expect(
        screen
          .getAllByTestId(/^ontology-data-asset-\w+-filter$/)
          .map((filter) => filter.dataset.testid)
      ).toEqual([
        'ontology-data-asset-service-filter',
        'ontology-data-asset-type-filter',
        'ontology-data-asset-domain-filter',
        'ontology-data-asset-owner-filter',
      ]);
    });

    it('narrows the search to one domain and one owner seen in the results', async () => {
      await screen.findByText('prescriptions');

      await pick(/label\.domain/, 'Clinical');
      await waitFor(() =>
        expect(lastFilter()).toContain(
          '{"term":{"domains.fullyQualifiedName":"Clinical"}}'
        )
      );

      await pick(/label\.owner/, 'Priya Raman');
      await waitFor(() =>
        expect(lastFilter()).toContain(
          '{"nested":{"path":"owners","query":{"term":{"owners.id":"u-1"}},"ignore_unmapped":true}}'
        )
      );

      expect(lastFilter()).toContain('domains.fullyQualifiedName');
    });
  });
});
