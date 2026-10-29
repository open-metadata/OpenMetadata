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
  getNativeOntologyDataGraphPage,
  getOntologyConceptBindings,
  putOntologyConceptBinding,
} from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import {
  pageFixture,
  prefixFixture,
} from '../../../../utils/governance/ontology/OntologyNativeDataGraph.mock';
import OntologyNativeDataMode from './OntologyNativeDataMode';

jest.mock('../../../../rest/ontologyAPI', () => ({
  getNativeOntologyDataGraphPage: jest.fn(),
  getOntologyConceptBindings: jest.fn(),
  putOntologyConceptBinding: jest.fn(),
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

const lastTransferRows = () =>
  pageFixture({
    bindings: {
      assets: [
        { id: 'a5', name: 'table_5', serviceType: 'Snowflake' },
        { id: 'a6', name: 'table_6', serviceType: 'Snowflake' },
      ],
    },
    loaded: [prefixFixture('transfer', 'a6'), prefixFixture('account')],
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

const SelectingMode = ({
  revision,
  onSelectConcept,
}: {
  revision: number;
  onSelectConcept: (conceptId: string) => void;
}) => {
  const [selectedConceptId, setSelectedConceptId] = useState('account');

  return (
    <OntologyNativeDataMode
      isActive
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

const renderMode = (onSelectConcept = jest.fn()) => {
  const tree = (revision: number) => (
    <MemoryRouter>
      <SelectingMode revision={revision} onSelectConcept={onSelectConcept} />
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

  expect(screen.getByText('label.loading')).toBeVisible();

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
    .mockResolvedValueOnce(firstPage())
    .mockResolvedValueOnce(
      pageFixture({
        bindings: { assets: [], after: 'cursor-after-hidden' },
        loaded: [prefixFixture('transfer', 'hidden'), prefixFixture('account')],
      })
    )
    .mockResolvedValueOnce(
      pageFixture({
        bindings: {
          assets: [
            { id: 'a5', name: 'table_5', serviceType: 'Snowflake' },
            { id: 'a6', name: 'table_6', serviceType: 'Snowflake' },
          ],
        },
        loaded: [prefixFixture('transfer', 'a6'), prefixFixture('account')],
      })
    );
  renderMode();
  await screen.findByTestId('ontology-data-cluster-transfer');

  fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));

  await waitFor(() => expect(rows('transfer')).toHaveLength(6));

  expect(rows('transfer').slice(4)).toEqual(['table_5', 'table_6']);
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

it('selects a concept from its header and opens an asset from its row', async () => {
  fetchPage.mockResolvedValueOnce(firstPage());
  const { onSelectConcept } = renderMode();
  await screen.findByTestId('ontology-data-cluster-transfer');

  fireEvent.click(screen.getByText('Funds Transfer'));
  fireEvent.click(screen.getByTestId('ontology-data-asset-asset:transfer:a1'));

  expect(onSelectConcept).toHaveBeenCalledWith('transfer');
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/table/svc.db.schema.table_1'
  );
});

it('says the view holds its maximum and offers no more clusters when the context is full', async () => {
  fetchPage.mockResolvedValueOnce(
    firstPage({ contextFull: true, nextClusterOffset: 12 })
  );
  renderMode();

  expect(
    await screen.findByTestId('ontology-data-context-full')
  ).toHaveTextContent('message.ontology-data-context-full');
  expect(screen.queryByText('label.load-more')).not.toBeInTheDocument();
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

it('shows the empty state for an ontology with no bound assets', async () => {
  fetchPage.mockResolvedValueOnce(pageFixture({ clusters: [], loaded: [] }));
  renderMode();

  expect(
    await screen.findByTestId('ontology-data-graph-empty')
  ).toHaveTextContent('message.no-data-available');
});

it('shows only the error, and no empty graph, when the first load fails', async () => {
  fetchPage.mockRejectedValueOnce(rejection(500));
  renderMode();

  expect(
    await screen.findByTestId('ontology-native-data-error')
  ).toHaveTextContent('message.ontology-data-graph-unavailable');
  expect(screen.queryByTestId('ontology-data-graph')).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('ontology-data-graph-empty')
  ).not.toBeInTheDocument();
});

it('offers more clusters instead of the empty state while the server still advertises some', async () => {
  const emptyPage = () =>
    pageFixture({ clusters: [], loaded: [], nextClusterOffset: 12 });
  fetchPage
    .mockResolvedValueOnce(emptyPage())
    .mockResolvedValueOnce(emptyPage());
  renderMode();

  expect(await screen.findByText('label.load-more')).toBeVisible();
  expect(
    screen.queryByTestId('ontology-data-graph-empty')
  ).not.toBeInTheDocument();
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
    expect(
      screen.getByTestId('ontology-data-cluster-account').className
    ).toMatch(/border-brand/);

    await act(async () =>
      answerReload(firstPage({ clusters: clustersWithTransferTotal(9) }))
    );

    expect(clusterCount('transfer')).toHaveTextContent('· 9');
    expect(screen.queryByText('label.loading')).not.toBeInTheDocument();
  });

  it('keeps an expanded cluster expanded through the reload', async () => {
    fetchPage
      .mockResolvedValueOnce(firstPage())
      .mockResolvedValueOnce(lastTransferRows())
      .mockResolvedValueOnce(firstPage())
      .mockResolvedValueOnce(lastTransferRows());
    const { changeModel } = renderMode();
    await screen.findByTestId('ontology-data-cluster-transfer');
    fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));
    await waitFor(() => expect(rows('transfer')).toHaveLength(6));

    changeModel(1);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(4));

    await waitFor(() => expect(rows('transfer')).toHaveLength(6));

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

  it('keeps the clusters, rows and selection the user loaded past the first clusters page', async () => {
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
    const { changeModel } = renderMode();
    await screen.findByTestId('ontology-data-cluster-transfer');
    fireEvent.click(screen.getByText('label.load-more'));
    await screen.findByTestId('ontology-data-cluster-ledger');
    fireEvent.click(screen.getByTestId('ontology-load-more-assets-ledger'));
    await waitFor(() => expect(rows('ledger')).toHaveLength(6));
    fireEvent.click(screen.getByText('Ledger'));

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
    expect(rows('transfer')).toHaveLength(4);
    expect(
      screen.getByTestId('ontology-data-cluster-ledger').className
    ).toMatch(/border-brand/);
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
