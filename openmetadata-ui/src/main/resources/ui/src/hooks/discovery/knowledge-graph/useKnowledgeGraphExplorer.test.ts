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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, PropsWithChildren } from 'react';
import { getGlossaryTermsByIds } from '../../../rest/glossaryAPI';
import { getEntityGraphData } from '../../../rest/rdfAPI';
import { GraphData } from '../../../rest/rdfAPI.interface';
import { getTableColumnsById } from '../../../rest/tableAPI';
import { useKnowledgeGraphExplorer } from './useKnowledgeGraphExplorer';

jest.mock('../../../rest/rdfAPI', () => ({ getEntityGraphData: jest.fn() }));
jest.mock('../../../rest/tableAPI', () => ({ getTableColumnsById: jest.fn() }));
jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTermsByIds: jest.fn(),
}));

const fetchGraph = getEntityGraphData as jest.MockedFunction<
  typeof getEntityGraphData
>;
const fetchColumns = getTableColumnsById as jest.MockedFunction<
  typeof getTableColumnsById
>;
const fetchTerms = getGlossaryTermsByIds as jest.MockedFunction<
  typeof getGlossaryTermsByIds
>;

const ROOT = 'urn:table:customers';

const node = (id: string, label: string, type: string) => ({
  id,
  label,
  type,
});

const fan = (
  ids: string[],
  label: string,
  relationType: string,
  incoming = false
) =>
  ids.map((id) =>
    incoming
      ? { from: id, to: ROOT, label, relationType }
      : { from: ROOT, to: id, label, relationType }
  );

/**
 * The neighbourhood of `red.dev.dbt_jaffle.customers` on the demo instance,
 * reduced to the repeats that drove this projection: the same five business
 * terms arriving as both glossary terms and tags, owners split across a user
 * and a team, and downstream assets of two different kinds.
 */
const terms = ['Active Customer', 'Channels', 'Review', 'Customer', 'Bank'];
const owners = ['Alice Chen', 'ajith.prasad', 'Alice Johnson', 'Akash Jain'];
const upstream = ['stg_payments', 'stg_customers', 'orders_processed'];

const graph: GraphData = {
  nodes: [
    node(ROOT, 'customers', 'table'),
    ...terms.map((label) => node('term:' + label, label, 'glossaryTerm')),
    ...['Person', 'Channels tag'].map((label) =>
      node('tag:' + label, label, 'tag')
    ),
    node('tag:Tier4', 'Tier4', 'tag'),
    ...owners.map((label) => node('user:' + label, label, 'user')),
    node('team:Finance', 'Finance', 'team'),
    node('user:Pere Miquel Brull', 'Pere Miquel Brull', 'user'),
    ...upstream.map((label) => node('table:' + label, label, 'table')),
    node('model:AccountsModel', 'AccountsModel', 'dashboardDataModel'),
    node('model:sales_datamart', 'sales_datamart', 'dashboardDataModel'),
    node('table:new_view', 'new_view', 'table'),
    node('schema:dbt_jaffle', 'dbt_jaffle', 'databaseSchema'),
  ],
  edges: [
    ...fan(
      terms.map((label) => 'term:' + label),
      'Has glossary term',
      'hasGlossaryTerm'
    ),
    ...fan(
      terms.map((label) => 'term:' + label),
      'Has tag',
      'hasTag'
    ),
    ...fan(
      ['tag:Person', 'tag:Channels tag', 'tag:Tier4'],
      'Has tag',
      'hasTag'
    ),
    { from: ROOT, to: 'tag:Tier4', label: 'Has tier', relationType: 'hasTier' },
    ...fan(
      owners.map((label) => 'user:' + label),
      'Has owner',
      'hasOwner'
    ),
    ...fan(['team:Finance', 'user:Pere Miquel Brull'], 'Owns', 'owns', true),
    ...fan(
      upstream.map((label) => 'table:' + label),
      'Upstream',
      'upstream',
      true
    ),
    ...fan(
      ['model:AccountsModel', 'model:sales_datamart', 'table:new_view'],
      'Downstream',
      'downstream'
    ),
    {
      from: 'schema:dbt_jaffle',
      to: ROOT,
      label: 'Contains',
      relationType: 'contains',
    },
  ],
};

const withClient = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
    },
  });
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);

  return { client, wrapper };
};

const renderExplorer = () => {
  const { wrapper } = withClient();

  return renderHook(
    () =>
      useKnowledgeGraphExplorer({
        entityId: ROOT,
        entityType: 'table',
        selectedLevel: 2,
        mode: 'knowledge-graph',
        filters: { entityTypes: [], relationshipTypes: [] },
        refresh: 0,
        excludedFamilies: [],
        coverageMode: 'all',
        presentation: 'balanced',
        expanded: [],
      }),
    { wrapper }
  );
};

describe('useKnowledgeGraphExplorer', () => {
  beforeEach(() => {
    fetchGraph.mockReset().mockResolvedValue(graph);
    fetchColumns
      .mockReset()
      .mockResolvedValue({ data: [], paging: { total: 0 } });
    fetchTerms.mockReset().mockResolvedValue([]);
  });

  it('draws one edge per repeated predicate and keeps every returned statement', async () => {
    const { result } = renderExplorer();
    await waitFor(() => expect(result.current.result.loading).toBe(false));
    const presented = result.current.presented.data;
    if (!presented) {
      throw new Error('Expected a projected graph');
    }
    const label = (id: string) =>
      presented.nodes.find((item) => item.id === id)?.label ?? id;

    expect(
      presented.edges
        .map((edge) => [
          edge.label,
          (edge.members ?? [edge]).length,
          label(edge.from === ROOT ? edge.to : edge.from),
        ])
        .sort()
    ).toEqual(
      [
        ['Contains', 1, 'dbt_jaffle'],
        ['Downstream', 3, 'dashboardDataModel'],
        ['Has glossary term', 5, 'glossaryTerm'],
        ['Has owner', 4, 'user'],
        ['Has tag', 1, 'Tier4'],
        ['Has tag', 2, 'tag'],
        ['Has tag', 5, 'glossaryTerm'],
        ['Has tier', 1, 'Tier4'],
        ['Owns', 2, 'team'],
        ['Upstream', 3, 'table'],
      ].sort()
    );
    expect(
      presented.edges.flatMap((edge) => edge.members ?? [edge])
    ).toHaveLength(graph.edges.length);
  });

  it('bundles the business terms and the owners the graph repeats', async () => {
    const { result } = renderExplorer();
    await waitFor(() => expect(result.current.result.loading).toBe(false));
    const bundles = (result.current.presented.data?.nodes ?? []).filter(
      (item) => item.presentation?.members
    );
    const memberLabels = (type: string) =>
      bundles
        .find((item) => item.type === type)
        ?.presentation?.members?.map((member) => member.label);

    const byLabel = (values: string[]) =>
      [...values].sort((left, right) => left.localeCompare(right));

    expect(memberLabels('glossaryTerm')).toEqual(byLabel(terms));
    expect(memberLabels('team')).toEqual(['Finance', 'Pere Miquel Brull']);
    expect(memberLabels('user')).toEqual(byLabel(owners));
    expect(
      result.current.presented.data?.nodes.filter(
        (item) => !item.presentation?.members
      )
    ).toHaveLength(3);
  });
});
