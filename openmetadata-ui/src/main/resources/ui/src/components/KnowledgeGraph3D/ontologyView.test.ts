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

import { ontologyView } from './ontologyView';
import {
  Graph3DData,
  GraphLink3D,
  GraphNode3D,
  Level,
  NodeType,
} from './types';

const node = (
  id: string,
  name: string,
  type: NodeType,
  levels: Level[] = ['asset']
): GraphNode3D => ({ id, name, type, levels });

const link = (source: string, target: string, label: string): GraphLink3D => ({
  source,
  target,
  label,
  kind: 'ontology',
  levels: ['asset'],
});

const idsOf = (nodes: GraphNode3D[]): string[] => nodes.map((n) => n.id).sort();

describe('ontologyView', () => {
  it('derives a Siblings edge for two assets under a shared parent term', () => {
    const graph: Graph3DData = {
      nodes: [
        node('accounts', 'Accounts', 'concept'),
        node('t-sav', 'Savings Account', 'concept'),
        node('t-chk', 'Checking Account', 'concept'),
        node('savings_account', 'savings_account', 'table'),
        node('checking_account', 'checking_account', 'table'),
      ],
      links: [
        link('accounts', 't-sav', 'Parent of'),
        link('accounts', 't-chk', 'Parent of'),
        link('savings_account', 't-sav', 'Mapped to'),
        link('checking_account', 't-chk', 'Mapped to'),
      ],
    };

    const view = ontologyView(graph, 'asset');

    expect(view.links).toHaveLength(1);

    const edge = view.links[0];

    expect(new Set([edge.source, edge.target])).toEqual(
      new Set(['savings_account', 'checking_account'])
    );
    expect(edge.derived).toBe(true);
    expect(edge.kind).toBe('ontology');
    expect(edge.relation).toEqual({ kind: 'siblings', term: 'Accounts' });
    expect(edge.path).toEqual([
      'savings_account',
      'Savings Account',
      'Accounts',
      'Checking Account',
      'checking_account',
    ]);
    expect(idsOf(view.nodes)).toEqual(['checking_account', 'savings_account']);
  });

  it('derives a "same term" edge and lays the term over each asset node', () => {
    const graph: Graph3DData = {
      nodes: [
        node('customer', 'Customer', 'concept'),
        node('customers', 'CUSTOMERS', 'table'),
        node('customer360', 'CUSTOMER360', 'table'),
      ],
      links: [
        link('customers', 'customer', 'Mapped to'),
        link('customer360', 'customer', 'Mapped to'),
      ],
    };

    const view = ontologyView(graph, 'asset');

    expect(view.links).toHaveLength(1);
    expect(view.links[0].relation).toEqual({ kind: 'same', term: 'Customer' });
    expect(view.links[0].path).toEqual([
      'CUSTOMERS',
      'Customer',
      'CUSTOMER360',
    ]);

    view.nodes.forEach((assetNode) => {
      expect(assetNode.term).toBe('Customer');
      expect(assetNode.termCount).toBe(1);
    });
  });

  it('prunes assets whose terms do not connect them to anything', () => {
    const graph: Graph3DData = {
      nodes: [
        node('customer', 'Customer', 'concept'),
        node('lonely-term', 'Lonely', 'concept'),
        node('customers', 'CUSTOMERS', 'table'),
        node('customer360', 'CUSTOMER360', 'table'),
        node('orphan', 'ORPHAN', 'table'),
      ],
      links: [
        link('customers', 'customer', 'Mapped to'),
        link('customer360', 'customer', 'Mapped to'),
        link('orphan', 'lonely-term', 'Mapped to'),
      ],
    };

    const view = ontologyView(graph, 'asset');

    expect(idsOf(view.nodes)).toEqual(['customer360', 'customers']);
    expect(view.nodes.some((n) => n.id === 'orphan')).toBe(false);
  });

  it('derives a broader/narrower (subtype) edge from a parent-child term pair', () => {
    const graph: Graph3DData = {
      nodes: [
        node('accounts', 'Accounts', 'concept'),
        node('t-sav', 'Savings Account', 'concept'),
        node('savings_account', 'savings_account', 'table'),
        node('all_accounts', 'all_accounts', 'table'),
      ],
      links: [
        link('accounts', 't-sav', 'Parent of'),
        link('savings_account', 't-sav', 'Mapped to'),
        link('all_accounts', 'accounts', 'Mapped to'),
      ],
    };

    const view = ontologyView(graph, 'asset');

    expect(view.links).toHaveLength(1);
    expect(view.links[0].relation).toEqual({
      kind: 'subtype',
      from: 'Savings Account',
      to: 'Accounts',
    });
    expect(view.links[0].path).toEqual([
      'savings_account',
      'Savings Account',
      'Accounts',
      'all_accounts',
    ]);
  });

  it('derives a related edge from related/synonym terms', () => {
    const graph: Graph3DData = {
      nodes: [
        node('revenue', 'Revenue', 'concept'),
        node('clv', 'Customer Lifetime Value', 'concept'),
        node('revenue_fact', 'REVENUE_FACT', 'table'),
        node('customer360', 'CUSTOMER360', 'table'),
      ],
      links: [
        link('revenue', 'clv', 'Related to'),
        link('revenue_fact', 'revenue', 'Mapped to'),
        link('customer360', 'clv', 'Mapped to'),
      ],
    };

    const view = ontologyView(graph, 'asset');

    expect(view.links).toHaveLength(1);
    expect(view.links[0].relation?.kind).toBe('related');
  });

  it('keeps the single strongest relationship when a pair matches several', () => {
    const graph: Graph3DData = {
      nodes: [
        node('shared', 'Shared', 'concept'),
        node('parent', 'Parent', 'concept'),
        node('child-a', 'Child A', 'concept'),
        node('child-b', 'Child B', 'concept'),
        node('asset_a', 'asset_a', 'table'),
        node('asset_b', 'asset_b', 'table'),
      ],
      links: [
        link('parent', 'child-a', 'Parent of'),
        link('parent', 'child-b', 'Parent of'),
        link('asset_a', 'shared', 'Mapped to'),
        link('asset_a', 'child-a', 'Mapped to'),
        link('asset_b', 'shared', 'Mapped to'),
        link('asset_b', 'child-b', 'Mapped to'),
      ],
    };

    const view = ontologyView(graph, 'asset');

    expect(view.links).toHaveLength(1);
    expect(view.links[0].relation).toEqual({ kind: 'same', term: 'Shared' });
  });

  it('ignores technical links and excludes concept nodes from the result', () => {
    const graph: Graph3DData = {
      nodes: [
        node('customer', 'Customer', 'concept'),
        node('customers', 'CUSTOMERS', 'table'),
        node('customer360', 'CUSTOMER360', 'table'),
      ],
      links: [
        link('customers', 'customer', 'Mapped to'),
        link('customer360', 'customer', 'Mapped to'),
        {
          source: 'customers',
          target: 'customer360',
          label: 'Downstream',
          kind: 'technical',
          levels: ['asset'],
        },
      ],
    };

    const view = ontologyView(graph, 'asset');

    expect(view.nodes.every((n) => n.type !== 'concept')).toBe(true);
    expect(view.links.every((l) => l.derived)).toBe(true);
  });

  it('scopes assets to the requested level', () => {
    const graph: Graph3DData = {
      nodes: [
        node('customer', 'Customer', 'concept', ['asset', 'product', 'domain']),
        node('customers', 'CUSTOMERS', 'table', ['asset']),
        node('customer360', 'CUSTOMER360', 'table', ['asset']),
      ],
      links: [
        link('customers', 'customer', 'Mapped to'),
        link('customer360', 'customer', 'Mapped to'),
      ],
    };

    expect(ontologyView(graph, 'asset').links).toHaveLength(1);
    expect(ontologyView(graph, 'domain').links).toHaveLength(0);
    expect(ontologyView(graph, 'domain').nodes).toHaveLength(0);
  });
});
