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
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { NativeOntologyDataGraphPage } from '../../../../generated/api/data/nativeOntologyDataGraphPage';
import { AssetType } from '../../../../generated/api/data/updateOntologyConceptBinding';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import {
  deleteOntologyConceptBinding,
  getNativeOntologyDataGraphPage,
  getOntologyConceptBindings,
  putOntologyConceptBinding,
} from '../../../../rest/ontologyAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import {
  pageFixture,
  prefixFixture,
} from '../../../../utils/governance/ontology/OntologyNativeDataGraph.mock';
import { showUndoToast } from '../../../../utils/governance/ontology/OntologyUndoToast';
import OntologyNativeDataMode from './OntologyNativeDataMode';

jest.mock('../../../../rest/ontologyAPI', () => ({
  deleteOntologyConceptBinding: jest.fn(),
  getNativeOntologyDataGraphPage: jest.fn(),
  getOntologyConceptBindings: jest.fn(),
  putOntologyConceptBinding: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('../../../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));
jest.mock('../../../../utils/governance/ontology/OntologyUndoToast', () => ({
  showUndoToast: jest.fn(),
}));

const fetchPage = getNativeOntologyDataGraphPage as jest.MockedFunction<
  typeof getNativeOntologyDataGraphPage
>;
const LOADED = [prefixFixture('transfer', 'a4'), prefixFixture('account')];

const rejection = (status: number) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const clustersWithTransferTotal = (count: number) => [
  {
    id: 'transfer',
    name: 'Funds Transfer',
    count,
    after: 'cursor-4',
    assets: [1, 2, 3, 4].map((n) => ({
      id: `a${n}`,
      name: `table_${n}`,
      serviceType: 'Snowflake',
    })),
  },
  {
    id: 'account',
    name: 'Account',
    count: 1,
    assets: [{ id: 'acc', name: 'accounts', serviceType: 'Mysql' }],
  },
];

const firstPage = (overrides: Parameters<typeof pageFixture>[0] = {}) =>
  pageFixture({
    clusters: clustersWithTransferTotal(6),
    loaded: LOADED,
    ...overrides,
  });

// The rest of an eight-asset Funds Transfer: past the six a collapsed graph shows.
const lastTransferRows = () =>
  pageFixture({
    bindings: {
      assets: [5, 6, 7, 8].map((n) => ({
        id: `a${n}`,
        name: `table_${n}`,
        serviceType: 'Snowflake',
      })),
    },
    loaded: [prefixFixture('transfer', 'a8'), prefixFixture('account')],
  });

const Location = () => (
  <output data-testid="location">{useLocation().pathname}</output>
);

const BindingWriter = () => {
  const { readState, replaceAsset } = useOntologyConceptBindings('transfer');

  return (
    <button
      disabled={readState !== 'ready'}
      onClick={() =>
        void replaceAsset({
          asset: { assetId: 'a7', assetType: AssetType.Table },
          expectedRevision: 0,
        })
      }>
      bind
    </button>
  );
};

const CONCEPTS = [
  { id: 'transfer', name: 'Funds Transfer' },
  { id: 'account', name: 'Account', parentName: 'Party' },
  { id: 'ledger', name: 'Ledger' },
  { id: 'unused', name: 'Unused' },
];

const NO_CONCEPT = '';

const SelectingMode = ({
  revision,
  initialConceptId = 'transfer',
  canEditBindings = false,
  onSelectConcept,
}: {
  revision: number;
  initialConceptId?: string;
  canEditBindings?: boolean;
  onSelectConcept: (conceptId: string) => void;
}) => {
  const [selectedConceptId, setSelectedConceptId] = useState(initialConceptId);

  return (
    <OntologyNativeDataMode
      isActive
      canEditBindings={canEditBindings}
      concepts={CONCEPTS}
      ontologyId="ontology-1"
      revision={revision}
      selectedConceptId={selectedConceptId}
      onSelectConcept={(conceptId) => {
        setSelectedConceptId(conceptId);
        onSelectConcept(conceptId);
      }}
    />
  );
};

const renderMode = (
  onSelectConcept = jest.fn(),
  options: { initialConceptId?: string; canEditBindings?: boolean } = {}
) => {
  const tree = (revision: number) => (
    <MemoryRouter>
      <SelectingMode
        revision={revision}
        onSelectConcept={onSelectConcept}
        {...options}
      />
      <Location />
      <BindingWriter />
    </MemoryRouter>
  );
  const view = renderWithQueryClient(tree(0));

  return {
    ...view,
    onSelectConcept,
    changeModel: (revision: number) => view.rerender(tree(revision)),
  };
};

const rows = (clusterId: string) =>
  within(screen.getByTestId(`ontology-data-cluster-rows-${clusterId}`))
    .getAllByTestId('ontology-data-asset-name')
    .map((name) => name.textContent);

const clusterCount = (clusterId: string) =>
  within(screen.getByTestId(`ontology-data-cluster-${clusterId}`)).getByTestId(
    'ontology-data-cluster-count'
  );

beforeEach(() => {
  localStorage.clear();
  fetchPage.mockReset();
  (getOntologyConceptBindings as jest.Mock).mockResolvedValue({
    kind: 'complete',
    revision: 0,
    assets: [],
  });
  (putOntologyConceptBinding as jest.Mock).mockResolvedValue({});
});

it('shows every returned cluster with its visible total once the first page arrives', async () => {
  fetchPage.mockResolvedValueOnce(firstPage());
  renderMode();

  expect(screen.getByText('message.ontology-data-loading')).toBeVisible();

  await screen.findByTestId('ontology-data-cluster-transfer');

  expect(rows('transfer')).toEqual([
    'table_1',
    'table_2',
    'table_3',
    'table_4',
  ]);
  expect(
    within(screen.getByTestId('ontology-data-cluster-transfer')).getByTestId(
      'ontology-data-cluster-count'
    )
  ).toHaveTextContent('· 6');
  expect(
    screen.getByTestId('ontology-load-more-assets-transfer')
  ).toHaveTextContent('label.load-more-count');
});

it('reaches a visible asset that follows an empty page with a non-null cursor', async () => {
  fetchPage
    .mockResolvedValueOnce(
      firstPage({ clusters: clustersWithTransferTotal(8) })
    )
    .mockResolvedValueOnce(
      pageFixture({
        bindings: { assets: [], after: 'cursor-after-hidden' },
        loaded: [prefixFixture('transfer', 'hidden'), prefixFixture('account')],
      })
    )
    .mockResolvedValueOnce(lastTransferRows());
  renderMode();
  await screen.findByTestId('ontology-data-cluster-transfer');

  fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));

  await waitFor(() => expect(rows('transfer')).toHaveLength(8));

  expect(rows('transfer').slice(4)).toEqual([
    'table_5',
    'table_6',
    'table_7',
    'table_8',
  ]);
  expect(fetchPage.mock.calls.map(([, request]) => request.page)).toEqual([
    { kind: 'clusters', limit: 12, offset: 0 },
    { kind: 'bindings', conceptId: 'transfer', after: 'cursor-4', limit: 25 },
    {
      kind: 'bindings',
      conceptId: 'transfer',
      after: 'cursor-after-hidden',
      limit: 25,
    },
  ]);
  expect(
    screen.queryByTestId('ontology-load-more-assets-transfer')
  ).not.toBeInTheDocument();
  expect(
    screen.getByTestId('ontology-show-less-assets-transfer')
  ).toBeVisible();
});

it('selects the concept from its header, opens an asset in a panel that stays in the Studio, and leaves only for Open asset', async () => {
  fetchPage.mockResolvedValueOnce(firstPage());
  const { onSelectConcept } = renderMode();
  await screen.findByTestId('ontology-data-cluster-transfer');

  fireEvent.click(
    within(screen.getByTestId('ontology-data-cluster-transfer')).getByText(
      'Funds Transfer'
    )
  );
  fireEvent.click(screen.getByTestId('ontology-data-asset-asset:transfer:a1'));

  expect(onSelectConcept).toHaveBeenCalledWith('transfer');

  const panel = await screen.findByTestId('ontology-data-asset-panel');

  expect(
    within(panel).getByTestId('ontology-data-asset-panel-name')
  ).toHaveTextContent('table_1');
  expect(
    within(panel).getByTestId('ontology-data-asset-panel-fqn')
  ).toHaveTextContent('svc.db.schema.table_1');
  expect(
    await within(panel).findByTestId('ontology-data-asset-panel-no-columns')
  ).toHaveTextContent('message.ontology-asset-no-bound-columns');
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);

  fireEvent.click(within(panel).getByTestId('ontology-data-asset-open'));

  expect(screen.getByTestId('location')).toHaveTextContent(
    '/table/svc.db.schema.table_1'
  );
});

it('closes the asset panel with Escape without leaving the Studio', async () => {
  fetchPage.mockResolvedValueOnce(firstPage());
  renderMode();
  await screen.findByTestId('ontology-data-cluster-transfer');
  fireEvent.click(screen.getByTestId('ontology-data-asset-asset:transfer:a2'));
  const panel = await screen.findByTestId('ontology-data-asset-panel');

  fireEvent.keyDown(panel, { key: 'Escape' });

  expect(
    screen.queryByTestId('ontology-data-asset-panel')
  ).not.toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
});

it('says the view holds its maximum, rather than that nothing is linked, for a concept past a full context', async () => {
  fetchPage.mockResolvedValueOnce(
    firstPage({ contextFull: true, nextClusterOffset: 12 })
  );
  renderMode(jest.fn(), { initialConceptId: 'ledger' });

  expect(
    await screen.findByTestId('ontology-data-context-full')
  ).toHaveTextContent('message.ontology-data-context-full');
  expect(screen.queryByTestId('ontology-data-empty')).not.toBeInTheDocument();
  expect(fetchPage).toHaveBeenCalledTimes(1);
});

it('shows the error with a retry after the topology restart also fails, and sends no third attempt', async () => {
  const withTopology = () => firstPage({ topologyAfter: 'topology-1' });
  fetchPage
    .mockResolvedValueOnce(withTopology())
    .mockRejectedValueOnce(rejection(400))
    .mockResolvedValueOnce(withTopology())
    .mockRejectedValueOnce(rejection(400));
  renderMode();

  const alert = await screen.findByTestId('ontology-native-data-error');

  expect(alert).toHaveTextContent('message.ontology-data-graph-unavailable');
  expect(fetchPage).toHaveBeenCalledTimes(4);
  expect(screen.getByTestId('ontology-data-cluster-transfer')).toBeVisible();

  fetchPage.mockResolvedValueOnce(firstPage());
  fireEvent.click(within(alert).getByRole('button', { name: 'label.retry' }));

  await waitFor(() =>
    expect(
      screen.queryByTestId('ontology-native-data-error')
    ).not.toBeInTheDocument()
  );

  expect(fetchPage).toHaveBeenCalledTimes(5);
});

it('names a stale context after the reload is stale too', async () => {
  fetchPage
    .mockResolvedValueOnce(firstPage())
    .mockRejectedValueOnce(rejection(412))
    .mockRejectedValueOnce(rejection(412));
  renderMode();
  await screen.findByTestId('ontology-data-cluster-transfer');

  fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));

  expect(
    await screen.findByTestId('ontology-native-data-error')
  ).toHaveTextContent('message.ontology-data-graph-stale');
  expect(fetchPage).toHaveBeenCalledTimes(3);
});

it('explains that the picked concept has no data, offers Link Asset, and shows neither the graph nor a bound-property count', async () => {
  fetchPage.mockResolvedValueOnce(firstPage());
  renderMode(jest.fn(), { initialConceptId: 'unused', canEditBindings: true });

  const empty = await screen.findByTestId('ontology-data-empty');

  expect(empty).toHaveTextContent('message.ontology-data-empty-title');
  expect(empty).toHaveTextContent('message.ontology-data-empty-hint');
  expect(
    within(empty).getByRole('button', { name: 'label.link-data-asset' })
  ).toBeVisible();
  expect(screen.queryByTestId('ontology-data-graph')).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('ontology-data-edge-legend')
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/properties-bound/)).not.toBeInTheDocument();
});

it('offers no Link Asset to a reader who cannot edit the concept', async () => {
  fetchPage.mockResolvedValueOnce(firstPage());
  renderMode(jest.fn(), { initialConceptId: 'unused' });

  await screen.findByTestId('ontology-data-empty');

  expect(
    screen.queryByTestId('ontology-data-link-asset')
  ).not.toBeInTheDocument();
});

it('shows only the error, and no empty graph, when the first load fails', async () => {
  fetchPage.mockRejectedValueOnce(rejection(500));
  renderMode();

  expect(
    await screen.findByTestId('ontology-native-data-error')
  ).toHaveTextContent('message.ontology-data-graph-unavailable');
  expect(screen.queryByTestId('ontology-data-graph')).not.toBeInTheDocument();
  // The concept stays on screen as the root the failed load hangs from.
  expect(screen.getByText('label.root')).toBeInTheDocument();
  expect(
    within(screen.getByTestId('ontology-native-data-error')).getByRole(
      'button',
      { name: 'label.retry' }
    )
  ).toBeVisible();
  expect(
    screen.queryByTestId('ontology-data-graph-empty')
  ).not.toBeInTheDocument();
});

it('shows only the picker, not the loading skeleton, before a concept is picked', () => {
  fetchPage.mockReturnValue(new Promise(() => undefined));
  renderMode(jest.fn(), { initialConceptId: NO_CONCEPT });

  expect(screen.getByTestId('ontology-data-no-pick')).toBeVisible();
  expect(
    screen.queryByTestId('ontology-data-skeleton')
  ).not.toBeInTheDocument();
});

it('shows only the picker, not the load error, before a concept is picked', async () => {
  fetchPage.mockRejectedValue(rejection(500));
  renderMode(jest.fn(), { initialConceptId: NO_CONCEPT });

  await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  await act(async () => undefined);

  expect(screen.getByTestId('ontology-data-no-pick')).toBeVisible();
  expect(
    screen.queryByTestId('ontology-native-data-error')
  ).not.toBeInTheDocument();
});

it('offers Link data only while the concept drawer is open', async () => {
  fetchPage.mockResolvedValue(firstPage());
  localStorage.setItem(
    'os-dataBy',
    JSON.stringify({
      'ontology-1': { recentIds: ['unused'], selectedId: 'unused' },
    })
  );
  renderMode(jest.fn(), {
    initialConceptId: NO_CONCEPT,
    canEditBindings: true,
  });

  expect(await screen.findByTestId('ontology-data-empty')).toBeVisible();
  expect(
    screen.queryByTestId('ontology-data-link-asset')
  ).not.toBeInTheDocument();
});

it('keeps loading the remaining clusters, and says nothing is linked only after the last page', async () => {
  const emptyPage = (offset?: number) =>
    pageFixture({ clusters: [], loaded: [], nextClusterOffset: offset });
  fetchPage
    .mockResolvedValueOnce(emptyPage(12))
    .mockResolvedValueOnce(emptyPage());
  renderMode(jest.fn(), { initialConceptId: 'unused' });

  expect(await screen.findByTestId('ontology-data-empty')).toBeVisible();
  expect(fetchPage.mock.calls.map(([, request]) => request.page)).toEqual([
    { kind: 'clusters', limit: 12, offset: 0 },
    { kind: 'clusters', limit: 12, offset: 12 },
  ]);
});

describe('a graph that went stale', () => {
  it('keeps the clusters and the selection on screen while it reloads', async () => {
    let answerReload!: (page: NativeOntologyDataGraphPage) => void;
    fetchPage.mockResolvedValueOnce(firstPage()).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerReload = resolve;
        })
    );
    const { changeModel } = renderMode();
    await screen.findByTestId('ontology-data-cluster-transfer');

    changeModel(1);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));

    expect(screen.getByText('label.loading')).toHaveAttribute('role', 'status');
    expect(clusterCount('transfer')).toHaveTextContent('· 6');
    expect(screen.getByTestId('ontology-data-root-transfer')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await act(async () =>
      answerReload(firstPage({ clusters: clustersWithTransferTotal(9) }))
    );

    expect(clusterCount('transfer')).toHaveTextContent('· 9');
    expect(screen.queryByText('label.loading')).not.toBeInTheDocument();
  });

  it('keeps an expanded cluster expanded through the reload', async () => {
    const eightTransfers = () =>
      firstPage({ clusters: clustersWithTransferTotal(8) });
    fetchPage
      .mockResolvedValueOnce(eightTransfers())
      .mockResolvedValueOnce(lastTransferRows())
      .mockResolvedValueOnce(eightTransfers())
      .mockResolvedValueOnce(lastTransferRows());
    const { changeModel } = renderMode();
    await screen.findByTestId('ontology-data-cluster-transfer');
    fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));
    await waitFor(() => expect(rows('transfer')).toHaveLength(8));

    changeModel(1);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(4));

    await waitFor(() => expect(rows('transfer')).toHaveLength(8));

    expect(
      screen.getByTestId('ontology-show-less-assets-transfer')
    ).toBeVisible();
    expect(fetchPage.mock.calls.map(([, request]) => request.page)).toEqual([
      { kind: 'clusters', limit: 12, offset: 0 },
      { kind: 'bindings', conceptId: 'transfer', after: 'cursor-4', limit: 25 },
      { kind: 'clusters', limit: 12, offset: 0 },
      { kind: 'bindings', conceptId: 'transfer', after: 'cursor-4', limit: 25 },
    ]);
  });

  it('keeps the concept, its rows and the selection through a reload, finding it past the first clusters page', async () => {
    const ledgerClusters = () =>
      pageFixture({
        clusters: [
          {
            id: 'ledger',
            name: 'Ledger',
            count: 6,
            after: 'ledger-4',
            assets: [1, 2, 3, 4].map((n) => ({
              id: `l${n}`,
              name: `ledger_${n}`,
            })),
          },
        ],
        loaded: [...LOADED, prefixFixture('ledger', 'l4')],
      });
    const lastLedgerRows = () =>
      pageFixture({
        bindings: {
          assets: [5, 6].map((n) => ({ id: `l${n}`, name: `ledger_${n}` })),
        },
        loaded: [...LOADED, prefixFixture('ledger', 'l6')],
      });
    fetchPage
      .mockResolvedValueOnce(firstPage({ nextClusterOffset: 12 }))
      .mockResolvedValueOnce(ledgerClusters())
      .mockResolvedValueOnce(lastLedgerRows())
      .mockResolvedValueOnce(firstPage({ nextClusterOffset: 12 }))
      .mockResolvedValueOnce(ledgerClusters())
      .mockResolvedValueOnce(lastLedgerRows());
    const { changeModel } = renderMode(jest.fn(), {
      initialConceptId: 'ledger',
    });
    await screen.findByTestId('ontology-data-cluster-ledger');
    fireEvent.click(screen.getByTestId('ontology-load-more-assets-ledger'));
    await waitFor(() => expect(rows('ledger')).toHaveLength(6));
    fireEvent.click(
      within(screen.getByTestId('ontology-data-cluster-ledger')).getByText(
        'Ledger'
      )
    );

    changeModel(1);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(6));
    await waitFor(() => expect(screen.queryByText('label.loading')).toBeNull());

    expect(rows('ledger')).toEqual([
      'ledger_1',
      'ledger_2',
      'ledger_3',
      'ledger_4',
      'ledger_5',
      'ledger_6',
    ]);
    expect(screen.getByTestId('ontology-data-root-ledger')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(fetchPage.mock.calls.map(([, request]) => request.page)).toEqual([
      { kind: 'clusters', limit: 12, offset: 0 },
      { kind: 'clusters', limit: 12, offset: 12 },
      { kind: 'bindings', conceptId: 'ledger', after: 'ledger-4', limit: 25 },
      { kind: 'clusters', limit: 12, offset: 0 },
      { kind: 'clusters', limit: 12, offset: 12 },
      { kind: 'bindings', conceptId: 'ledger', after: 'ledger-4', limit: 25 },
    ]);
  });

  it('shows the new total after a binding write', async () => {
    fetchPage
      .mockResolvedValueOnce(firstPage())
      .mockResolvedValueOnce(
        firstPage({ clusters: clustersWithTransferTotal(7) })
      );
    renderMode();
    await screen.findByTestId('ontology-data-cluster-transfer');

    expect(clusterCount('transfer')).toHaveTextContent('· 6');

    const bind = screen.getByRole('button', { name: 'bind' });
    await waitFor(() => expect(bind).toBeEnabled());
    fireEvent.click(bind);

    await waitFor(() =>
      expect(clusterCount('transfer')).toHaveTextContent('· 7')
    );

    expect(putOntologyConceptBinding).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});

describe('the concept picker', () => {
  const optionNames = () =>
    screen
      .getAllByRole('option')
      .map((option) => option.textContent?.replace(/\s+/g, ' '));

  it('asks which concept to show, grouping concepts with data by count before those without', async () => {
    fetchPage.mockResolvedValueOnce(firstPage());
    renderMode(jest.fn(), { initialConceptId: NO_CONCEPT });

    expect(
      await screen.findByText('message.ontology-data-pick-title')
    ).toBeVisible();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-data-concept-picker-trigger'));

    await waitFor(() =>
      expect(optionNames()).toEqual([
        'Funds Transferlabel.count-asset',
        'AccountPartylabel.count-asset',
        'Ledgerlabel.no-data',
        'Unusedlabel.no-data',
      ])
    );

    expect(screen.queryByTestId('ontology-data-graph')).not.toBeInTheDocument();
  });

  it('opens the empty-state picker in place as a search field with the list below it', async () => {
    fetchPage.mockResolvedValue(firstPage());
    renderMode(jest.fn(), { initialConceptId: NO_CONCEPT });

    fireEvent.click(
      await screen.findByTestId('ontology-data-concept-picker-trigger')
    );
    const search = await screen.findByTestId('ontology-data-concept-search');

    expect(
      screen.queryByTestId('ontology-data-concept-picker-trigger')
    ).not.toBeInTheDocument();
    expect(search).toHaveAttribute('placeholder', 'label.search-concepts…');

    fireEvent.keyDown(search, { key: 'Escape' });

    expect(
      screen.getByTestId('ontology-data-concept-picker-trigger')
    ).toBeVisible();
    expect(
      screen.queryByTestId('ontology-data-concept-picker')
    ).not.toBeInTheDocument();
  });

  it('shows the picked concept with its chip, tells the Studio, and restores it on the next visit', async () => {
    fetchPage.mockResolvedValue(firstPage());
    const { onSelectConcept, unmount } = renderMode(jest.fn(), {
      initialConceptId: NO_CONCEPT,
    });
    fireEvent.click(
      await screen.findByTestId('ontology-data-concept-picker-trigger')
    );
    fireEvent.click(
      await screen.findByTestId('ontology-data-concept-option-account')
    );

    expect(
      await screen.findByTestId('ontology-data-cluster-account')
    ).toBeVisible();
    expect(
      screen.queryByTestId('ontology-data-cluster-transfer')
    ).not.toBeInTheDocument();
    expect(onSelectConcept).toHaveBeenCalledWith('account');
    expect(screen.getByTestId('ontology-data-concept-chip')).toHaveTextContent(
      'Account'
    );
    expect(localStorage.getItem('os-dataBy')).toBe(
      JSON.stringify({
        'ontology-1': { recentIds: ['account'], selectedId: 'account' },
      })
    );

    unmount();
    renderMode(jest.fn(), { initialConceptId: NO_CONCEPT });

    expect(
      await screen.findByTestId('ontology-data-cluster-account')
    ).toBeVisible();
  });

  it('returns to the picker when the pick is cleared', async () => {
    fetchPage.mockResolvedValue(firstPage());
    renderMode();
    await screen.findByTestId('ontology-data-cluster-transfer');

    fireEvent.click(screen.getByTestId('ontology-data-concept-clear'));

    expect(screen.getByText('message.ontology-data-pick-title')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-data-cluster-transfer')
    ).not.toBeInTheDocument();
  });

  it('moves with the arrow keys, picks with Enter, and closes the switcher with Escape', async () => {
    fetchPage.mockResolvedValue(firstPage());
    renderMode();
    await screen.findByTestId('ontology-data-cluster-transfer');

    fireEvent.click(screen.getByTestId('ontology-data-concept-change'));
    const search = await screen.findByTestId('ontology-data-concept-search');
    fireEvent.keyDown(search, { key: 'Escape' });

    expect(screen.queryByTestId('ontology-data-concept-picker')).toBeNull();

    fireEvent.click(screen.getByTestId('ontology-data-concept-change'));
    const reopened = await screen.findByTestId('ontology-data-concept-search');
    fireEvent.keyDown(reopened, { key: 'ArrowDown' });
    fireEvent.keyDown(reopened, { key: 'Enter' });

    expect(
      await screen.findByTestId('ontology-data-cluster-account')
    ).toBeVisible();
  });

  it('marks the shown concept in the switcher and links data to it from there', async () => {
    fetchPage.mockResolvedValue(firstPage());
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: { total: { value: 0 }, hits: [] },
    });
    renderMode(jest.fn(), { canEditBindings: true });
    await screen.findByTestId('ontology-data-cluster-transfer');

    fireEvent.click(screen.getByTestId('ontology-data-concept-change'));
    const shown = await screen.findByTestId(
      'ontology-data-concept-option-transfer'
    );

    expect(shown.querySelector('svg')).not.toBeNull();
    expect(
      screen
        .getByTestId('ontology-data-concept-option-account')
        .querySelector('svg')
    ).toBeNull();

    const link = await screen.findByTestId('ontology-data-concept-link-data');

    expect(link).toHaveTextContent('label.link-data-to-entity');

    fireEvent.click(link);

    expect(
      await screen.findByTestId('ontology-data-link-dialog')
    ).toBeVisible();
    expect(
      screen.queryByTestId('ontology-data-concept-picker')
    ).not.toBeInTheDocument();
  });
});

describe('bound columns, unlinking and linking', () => {
  const amountColumn = {
    columnPath: ['amount'],
    propertyId: 'p-amount',
    property: {
      id: 'p-amount',
      name: 'amountProperty',
      type: 'ontologyProperty',
    },
    column: {
      name: 'amount',
      dataType: 'DECIMAL',
      dataTypeDisplay: 'decimal(10,2)',
    },
    state: 'resolved',
  };
  const boundAsset = {
    assetId: 'a1',
    assetType: 'table',
    asset: {
      id: 'a1',
      name: 'table_1',
      type: 'table',
      fullyQualifiedName: 'svc.db.schema.table_1',
    },
    columns: [amountColumn],
  };

  it('draws the bound columns of an asset as nodes beside its row, counts them in the chip and names them in the legend', async () => {
    (getOntologyConceptBindings as jest.Mock).mockResolvedValue({
      kind: 'complete',
      revision: 2,
      assets: [boundAsset],
    });
    fetchPage.mockResolvedValue(firstPage());
    renderMode();

    const toggle = await screen.findByTestId(
      'ontology-data-asset-columns-toggle-asset:transfer:a1'
    );

    expect(
      screen.queryByTestId('ontology-data-column')
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);
    const node = screen.getByTestId('ontology-data-column');

    expect(node).toHaveTextContent('amount');
    expect(node).toHaveTextContent('decimal(10,2)');
    expect(screen.getAllByTestId('ontology-data-column-edge')).toHaveLength(1);
    expect(
      screen.getByTestId('ontology-data-concept-summary')
    ).toHaveTextContent('label.bound-column-count');
    expect(
      screen.getByTestId('ontology-data-legend-column-binding')
    ).toBeVisible();
    expect(
      screen.queryByTestId(
        'ontology-data-asset-columns-toggle-asset:transfer:a2'
      )
    ).not.toBeInTheDocument();
  });

  it('shows the binding of a selected column node, and returns to the asset when the asset is selected', async () => {
    (getOntologyConceptBindings as jest.Mock).mockResolvedValue({
      kind: 'complete',
      revision: 2,
      assets: [boundAsset],
    });
    fetchPage.mockResolvedValue(firstPage());
    renderMode();
    fireEvent.click(
      await screen.findByTestId(
        'ontology-data-asset-columns-toggle-asset:transfer:a1'
      )
    );

    fireEvent.click(screen.getByTestId('ontology-data-column'));
    const panel = await screen.findByTestId('ontology-data-column-panel');

    expect(
      within(panel).getByTestId('ontology-data-column-panel-column')
    ).toHaveTextContent('amount');
    expect(
      within(panel).getByTestId('ontology-data-column-panel-property')
    ).toHaveTextContent('amountProperty');
    expect(
      within(panel).getByTestId('ontology-data-column-panel-asset')
    ).toHaveTextContent('table_1');
    expect(screen.getByTestId('ontology-data-column')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      screen.queryByTestId('ontology-data-asset-panel')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId('ontology-data-asset-asset:transfer:a1')
    );

    expect(
      await screen.findByTestId('ontology-data-asset-panel')
    ).toBeVisible();
    expect(
      screen.queryByTestId('ontology-data-column-panel')
    ).not.toBeInTheDocument();
  });

  it('unlinks from the panel after naming the asset, the concept and the columns, and Undo puts the columns back', async () => {
    let isRemoved = false;
    (getOntologyConceptBindings as jest.Mock).mockImplementation(async () =>
      isRemoved
        ? { kind: 'complete', revision: 3, assets: [] }
        : { kind: 'complete', revision: 2, assets: [boundAsset] }
    );
    (deleteOntologyConceptBinding as jest.Mock).mockImplementation(async () => {
      isRemoved = true;
    });
    fetchPage.mockResolvedValue(firstPage());
    renderMode(jest.fn(), { canEditBindings: true });
    await screen.findByTestId('ontology-data-cluster-transfer');
    fireEvent.click(
      screen.getByTestId('ontology-data-asset-asset:transfer:a1')
    );
    const panel = await screen.findByTestId('ontology-data-asset-panel');
    const unlink = within(panel).getByTestId('ontology-data-asset-unlink');
    await waitFor(() => expect(unlink).toBeEnabled());

    expect(
      within(panel).getByTestId('ontology-data-asset-panel-columns')
    ).toHaveTextContent('amount');

    fireEvent.click(unlink);
    const confirm = await screen.findByTestId('ontology-unlink');

    expect(confirm).toHaveTextContent('message.ontology-unlink-asset-title');
    expect(confirm).toHaveTextContent('message.ontology-unlink-asset-columns');
    expect(deleteOntologyConceptBinding).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByTestId('ontology-unlink-confirm'));
    await waitFor(() =>
      expect(deleteOntologyConceptBinding).toHaveBeenCalledWith('transfer', {
        assetId: 'a1',
        assetType: 'table',
        expectedRevision: 2,
      })
    );
    await waitFor(() => expect(showUndoToast).toHaveBeenCalledTimes(1));

    await act(async () => {
      await (showUndoToast as jest.Mock).mock.calls[0][1]();
    });

    expect(putOntologyConceptBinding).toHaveBeenCalledWith('transfer', {
      expectedRevision: 3,
      asset: {
        assetId: 'a1',
        assetType: 'table',
        columns: [{ columnPath: ['amount'], propertyId: 'p-amount' }],
      },
    });
  });

  it('links a table from the empty state through Link Asset', async () => {
    fetchPage.mockResolvedValue(firstPage());
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _source: {
              id: 'new-table',
              name: 'new_table',
              entityType: 'table',
              fullyQualifiedName: 'svc.db.schema.new_table',
            },
          },
        ],
      },
    });
    renderMode(jest.fn(), {
      initialConceptId: 'unused',
      canEditBindings: true,
    });
    const link = await screen.findByTestId('ontology-data-link-asset');
    await waitFor(() => expect(link).toBeEnabled());

    fireEvent.click(link);
    const dialog = await screen.findByTestId('ontology-data-link-dialog');
    fireEvent.click(
      await within(dialog).findByRole('checkbox', { name: 'new_table' })
    );
    fireEvent.click(within(dialog).getByTestId('ontology-data-asset-save'));

    await waitFor(() =>
      expect(putOntologyConceptBinding).toHaveBeenCalledWith('unused', {
        expectedRevision: 0,
        asset: { assetId: 'new-table', assetType: 'table', columns: [] },
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-data-link-dialog')
      ).not.toBeInTheDocument()
    );
  });
});
