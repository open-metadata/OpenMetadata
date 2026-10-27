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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { getNativeOntologyDataGraphPage } from '../../../../rest/ontologyAPI';
import {
  pageFixture,
  prefixFixture,
} from '../../../../utils/governance/ontology/OntologyNativeDataGraph.mock';
import OntologyNativeDataMode from './OntologyNativeDataMode';

jest.mock('../../../../rest/ontologyAPI', () => ({
  getNativeOntologyDataGraphPage: jest.fn(),
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

const firstPage = (overrides: Parameters<typeof pageFixture>[0] = {}) =>
  pageFixture({
    clusters: [
      {
        id: 'transfer',
        name: 'Funds Transfer',
        count: 6,
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
    ],
    loaded: LOADED,
    ...overrides,
  });

const Location = () => (
  <output data-testid="location">{useLocation().pathname}</output>
);

const renderMode = (onSelectConcept = jest.fn()) => {
  const view = render(
    <MemoryRouter>
      <OntologyNativeDataMode
        ontologyId="ontology-1"
        selectedConceptId="account"
        onSelectConcept={onSelectConcept}
      />
      <Location />
    </MemoryRouter>
  );

  return { ...view, onSelectConcept };
};

const rows = (clusterId: string) =>
  within(screen.getByTestId(`ontology-data-cluster-rows-${clusterId}`))
    .getAllByTestId('ontology-data-asset-name')
    .map((name) => name.textContent);

beforeEach(() => {
  fetchPage.mockReset();
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
    firstPage({ contextFull: true, nextClusterOffset: undefined })
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
