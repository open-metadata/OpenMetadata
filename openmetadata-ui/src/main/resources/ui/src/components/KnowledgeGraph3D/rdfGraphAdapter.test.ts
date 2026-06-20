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

import { GraphData } from '../../rest/rdfAPI.interface';
import {
  adaptRdfGraph,
  classifyEdge,
  enrichWithEntityFields,
  normalizeNodeType,
  relationsOf,
} from './rdfGraphAdapter';

const SAMPLE: GraphData = {
  nodes: [
    { id: 'T1', label: 'CUSTOMERS', type: 'table' },
    { id: 'T2', label: 'ORDERS', type: 'table' },
    { id: 'T3', label: 'SESSIONS', type: 'table' },
    { id: 'C1', label: 'email', type: 'column' },
    { id: 'CON1', label: 'Customer', type: 'glossaryTerm' },
    { id: 'CON2', label: 'PII', type: 'glossaryTerm' },
    { id: 'CON3', label: 'Loyal Customer', type: 'glossaryTerm' },
    { id: 'DOM', label: 'Sales', type: 'domain' },
    { id: 'PROD', label: 'Customer 360', type: 'dataProduct' },
    { id: 'USR', label: 'Hima R.', type: 'user' },
    { id: 'SCH', label: 'COLLATE_SHOP', type: 'databaseSchema' },
  ],
  edges: [
    { from: 'T1', to: 'C1', label: 'hasColumn' },
    { from: 'T1', to: 'USR', label: 'ownedBy' },
    { from: 'T1', to: 'SCH', label: 'belongsToSchema' },
    { from: 'T1', to: 'CON1', label: 'mappedTo' },
    { from: 'T1', to: 'CON2', label: 'mappedTo' },
    { from: 'T2', to: 'CON1', label: 'mappedTo' },
    { from: 'CON1', to: 'CON3', label: 'parentOf' },
    { from: 'CON1', to: 'CON2', label: 'relatedTo' },
    { from: 'T2', to: 'T1', label: 'downstream' },
    { from: 'T1', to: 'PROD', label: 'inputPort' },
    { from: 'PROD', to: 'DOM', label: 'partOfDomain' },
  ],
};

describe('normalizeNodeType', () => {
  it('should map RDF entity types to renderer node types', () => {
    expect(normalizeNodeType('glossaryTerm')).toBe('concept');
    expect(normalizeNodeType('dataProduct')).toBe('product');
    expect(normalizeNodeType('databaseSchema')).toBe('schema');
    expect(normalizeNodeType('Table')).toBe('table');
  });

  it('should map the broader entity zoo to distinct node types', () => {
    expect(normalizeNodeType('topic')).toBe('topic');
    expect(normalizeNodeType('container')).toBe('container');
    expect(normalizeNodeType('mlmodel')).toBe('mlmodel');
    expect(normalizeNodeType('searchIndex')).toBe('searchIndex');
    expect(normalizeNodeType('storedProcedure')).toBe('storedProcedure');
    expect(normalizeNodeType('testCase')).toBe('testCase');
    expect(normalizeNodeType('testSuite')).toBe('testSuite');
    expect(normalizeNodeType('dataContract')).toBe('dataContract');
    expect(normalizeNodeType('apiEndpoint')).toBe('api');
    expect(normalizeNodeType('chart')).toBe('chart');
    expect(normalizeNodeType('file')).toBe('file');
    expect(normalizeNodeType('directory')).toBe('directory');
  });

  it('should collapse all connector services to a single service type', () => {
    expect(normalizeNodeType('pipelineService')).toBe('service');
    expect(normalizeNodeType('messagingService')).toBe('service');
    expect(normalizeNodeType('mlmodelService')).toBe('service');
  });

  it('should fall back to table for genuinely unknown types', () => {
    expect(normalizeNodeType('somethingUnheardOf')).toBe('table');
  });
});

describe('classifyEdge', () => {
  it('should classify a table -> concept mapping as an ontology "Mapped to" link', () => {
    expect(classifyEdge('mappedTo', 'table', 'concept')).toEqual({
      kind: 'ontology',
      label: 'Mapped to',
    });
  });

  it('should classify concept -> concept hierarchy as ontology', () => {
    expect(classifyEdge('parentOf', 'concept', 'concept')).toEqual({
      kind: 'ontology',
      label: 'Parent of',
    });
    expect(classifyEdge('relatedTo', 'concept', 'concept')).toEqual({
      kind: 'ontology',
      label: 'Related to',
    });
  });

  it('should classify structural relations as technical', () => {
    expect(classifyEdge('hasColumn', 'table', 'column')).toEqual({
      kind: 'technical',
      label: 'Has column',
    });
    expect(classifyEdge('downstream', 'table', 'table')).toEqual({
      kind: 'technical',
      label: 'Downstream',
    });
  });

  it('should keep ownership of a concept technical, not ontology', () => {
    expect(classifyEdge('ownedBy', 'concept', 'user').kind).toBe('technical');
  });

  it('should keep known technical relations technical even when touching a concept', () => {
    expect(classifyEdge('hasTag', 'concept', 'tag')).toEqual({
      kind: 'technical',
      label: 'Has tag',
    });
    expect(classifyEdge('inputPort', 'product', 'concept')).toEqual({
      kind: 'technical',
      label: 'Input port',
    });
    expect(classifyEdge('partOfDomain', 'concept', 'domain')).toEqual({
      kind: 'technical',
      label: 'Part of domain',
    });
    expect(classifyEdge('downstream', 'concept', 'concept').kind).toBe(
      'technical'
    );
  });

  it('should still default an unknown concept-touching relation to ontology', () => {
    expect(classifyEdge('associatedWith', 'table', 'concept')).toEqual({
      kind: 'ontology',
      label: 'Mapped to',
    });
  });

  it('should humanize unknown labels and default them to technical', () => {
    expect(classifyEdge('someCustomRelation', 'table', 'table')).toEqual({
      kind: 'technical',
      label: 'Some custom relation',
    });
  });
});

describe('adaptRdfGraph', () => {
  it('should return an empty graph for null input', () => {
    expect(adaptRdfGraph(null)).toEqual({ nodes: [], links: [] });
  });

  it('should derive node levels from the entity type', () => {
    const { nodes } = adaptRdfGraph(SAMPLE);
    const byId = new Map(nodes.map((node) => [node.id, node]));

    expect(byId.get('T1')?.levels).toEqual(['asset', 'product', 'domain']);
    expect(byId.get('C1')?.levels).toEqual(['asset']);
    expect(byId.get('DOM')?.levels).toEqual(['domain']);
    expect(byId.get('PROD')?.levels).toEqual(['product', 'domain']);
    expect(byId.get('CON1')?.levels).toEqual(['asset', 'product', 'domain']);
  });

  it('should flag mapped vs unmapped tables for coverage gaps', () => {
    const { nodes } = adaptRdfGraph(SAMPLE);
    const byId = new Map(nodes.map((node) => [node.id, node]));

    expect(byId.get('T1')?.mapped).toBe(true);
    expect(byId.get('T2')?.mapped).toBe(true);
    expect(byId.get('T3')?.mapped).toBe(false);
  });

  it('should intersect endpoint levels to compute link visibility levels', () => {
    const { links } = adaptRdfGraph(SAMPLE);
    const columnLink = links.find(
      (l) => l.source === 'T1' && l.target === 'C1'
    );
    const mappingLink = links.find(
      (l) => l.source === 'T1' && l.target === 'CON1'
    );

    expect(columnLink?.levels).toEqual(['asset']);
    expect(mappingLink?.levels).toEqual(['asset', 'product', 'domain']);
  });

  it('should classify each link kind from the RDF label and node types', () => {
    const { links } = adaptRdfGraph(SAMPLE);
    const findLink = (source: string, target: string): (typeof links)[number] =>
      links.find((l) => l.source === source && l.target === target)!;

    expect(findLink('T1', 'CON1').kind).toBe('ontology');
    expect(findLink('CON1', 'CON3').label).toBe('Parent of');
    expect(findLink('T1', 'C1').kind).toBe('technical');
    expect(findLink('T2', 'T1').label).toBe('Downstream');
  });
});

describe('relationsOf', () => {
  const graph = adaptRdfGraph(SAMPLE);

  it("should bucket a table's mapped concepts, members and technical relations", () => {
    const relations = relationsOf(graph, 'T1');

    expect(relations.mapped.map((r) => r.other.id).sort()).toEqual([
      'CON1',
      'CON2',
    ]);
    // "Input port" (PROD) and "Belongs to schema" (SCH) belong to the members group.
    expect(relations.members.map((r) => r.other.id).sort()).toEqual([
      'PROD',
      'SCH',
    ]);
    expect(relations.technical.map((r) => r.other.id).sort()).toEqual([
      'C1',
      'T2',
      'USR',
    ]);
  });

  it('should compute assets related through a shared concept (one ontology hop)', () => {
    const relations = relationsOf(graph, 'T1');

    expect(relations.shared.map((r) => r.asset.id)).toEqual(['T2']);
    expect(relations.shared[0].via).toBe('Customer');
  });

  it('should expose concept hierarchy for a concept node', () => {
    const relations = relationsOf(graph, 'CON1');
    const labels = relations.hierarchy.map((r) => r.label).sort();

    expect(labels).toContain('Parent of');
    expect(labels).toContain('Related to');
  });
});

// A coverage-gap (unmapped) table must still expose its full technical relation set.
const UNMAPPED: GraphData = {
  nodes: [
    { id: 'S1', label: 'SESSIONS', type: 'table' },
    { id: 'SC', label: 'WEB_ANALYTICS', type: 'databaseSchema' },
    { id: 'DB', label: 'CUSTOMERS', type: 'database' },
    { id: 'SV', label: 'snow-lau', type: 'databaseService' },
    { id: 'U', label: 'Lena K.', type: 'user' },
    { id: 'TG', label: 'Raw', type: 'tag' },
    { id: 'S2', label: 'SESSION_FACT', type: 'table' },
  ],
  edges: [
    { from: 'S1', to: 'SC', label: 'belongsToSchema' },
    { from: 'SC', to: 'DB', label: 'belongsToDatabase' },
    { from: 'SC', to: 'SV', label: 'belongsToService' },
    { from: 'S1', to: 'U', label: 'ownedBy' },
    { from: 'S1', to: 'TG', label: 'hasTag' },
    { from: 'S2', to: 'S1', label: 'downstream' },
  ],
};

describe('coverage-gap relations', () => {
  const graph = adaptRdfGraph(UNMAPPED);

  it('should flag an unmapped table while keeping its full technical relation set', () => {
    const session = graph.nodes.find((n) => n.id === 'S1');
    const relations = relationsOf(graph, 'S1');

    expect(session?.mapped).toBe(false);
    // Ontology side is empty (the coverage gap)...
    expect(relations.mapped).toHaveLength(0);
    expect(relations.hierarchy).toHaveLength(0);
    // ...but every technical relation is still present and grouped.
    expect(relations.members.map((r) => r.label)).toEqual([
      'Belongs to schema',
    ]);
    expect(relations.technical.map((r) => r.label).sort()).toEqual([
      'Downstream',
      'Has tag',
      'Owned by',
    ]);
  });
});

describe('enrichWithEntityFields', () => {
  const tableGraph = adaptRdfGraph({
    nodes: [
      {
        id: 'iri-table',
        label: 'CUSTOMERS',
        type: 'table',
        fullyQualifiedName: 'db.schema.CUSTOMERS',
      },
    ],
    edges: [],
  });

  it('should add Has column relations from a table when RDF omits columns', () => {
    const enriched = enrichWithEntityFields(tableGraph, {
      fullyQualifiedName: 'db.schema.CUSTOMERS',
      columns: [{ name: 'id' }, { name: 'email' }],
    });
    const columns = enriched.nodes.filter((n) => n.type === 'column');
    const hasColumnLinks = enriched.links.filter(
      (l) => l.label === 'Has column'
    );

    expect(columns.map((c) => c.name).sort()).toEqual(['email', 'id']);
    expect(hasColumnLinks).toHaveLength(2);
    expect(hasColumnLinks.every((l) => l.source === 'iri-table')).toBe(true);
  });

  it('should add Has field relations from a topic messageSchema', () => {
    const topicGraph = adaptRdfGraph({
      nodes: [
        {
          id: 'iri-topic',
          label: 'orders',
          type: 'topic',
          fullyQualifiedName: 'svc.orders',
        },
      ],
      edges: [],
    });
    const enriched = enrichWithEntityFields(topicGraph, {
      fullyQualifiedName: 'svc.orders',
      messageSchema: {
        schemaFields: [{ name: 'orderId' }, { name: 'amount' }],
      },
    });

    expect(enriched.links.filter((l) => l.label === 'Has field')).toHaveLength(
      2
    );
  });

  it('should be a no-op when the focus entity is not in the graph', () => {
    const enriched = enrichWithEntityFields(tableGraph, {
      fullyQualifiedName: 'no.such.entity',
      columns: [{ name: 'id' }],
    });

    expect(enriched.nodes).toHaveLength(1);
  });

  it('should return the same graph reference when the focus node is missing', () => {
    const enriched = enrichWithEntityFields(tableGraph, {
      fullyQualifiedName: 'no.such.entity',
      columns: [{ name: 'id' }],
    });

    expect(enriched).toBe(tableGraph);
  });

  it('should return the same graph reference when the entity carries no fields', () => {
    const enriched = enrichWithEntityFields(tableGraph, {
      fullyQualifiedName: 'db.schema.CUSTOMERS',
    });

    expect(enriched).toBe(tableGraph);
  });

  it('should add Has column relations from a container dataModel.columns', () => {
    const containerGraph = adaptRdfGraph({
      nodes: [
        {
          id: 'iri-container',
          label: 'events',
          type: 'container',
          fullyQualifiedName: 'svc.events',
        },
      ],
      edges: [],
    });
    const enriched = enrichWithEntityFields(containerGraph, {
      fullyQualifiedName: 'svc.events',
      dataModel: { columns: [{ name: 'eventId' }, { name: 'payload' }] },
    });
    const columns = enriched.nodes.filter((n) => n.type === 'column');
    const hasColumnLinks = enriched.links.filter(
      (l) => l.label === 'Has column'
    );

    expect(columns.map((c) => c.name).sort()).toEqual(['eventId', 'payload']);
    expect(hasColumnLinks).toHaveLength(2);
    expect(hasColumnLinks.every((l) => l.source === 'iri-container')).toBe(
      true
    );
  });

  it('should add Has field relations from a searchIndex fields list', () => {
    const searchIndexGraph = adaptRdfGraph({
      nodes: [
        {
          id: 'iri-search',
          label: 'customer_search',
          type: 'searchIndex',
          fullyQualifiedName: 'svc.customer_search',
        },
      ],
      edges: [],
    });
    const enriched = enrichWithEntityFields(searchIndexGraph, {
      fullyQualifiedName: 'svc.customer_search',
      fields: [{ name: 'firstName' }, { name: 'lastName' }],
    });
    const fieldNodes = enriched.nodes.filter((n) => n.type === 'column');
    const hasFieldLinks = enriched.links.filter((l) => l.label === 'Has field');

    expect(fieldNodes.map((f) => f.name).sort()).toEqual([
      'firstName',
      'lastName',
    ]);
    expect(hasFieldLinks).toHaveLength(2);
    expect(hasFieldLinks.every((l) => l.source === 'iri-search')).toBe(true);
  });

  it('should prefer displayName over name for the field node name', () => {
    const enriched = enrichWithEntityFields(tableGraph, {
      fullyQualifiedName: 'db.schema.CUSTOMERS',
      columns: [{ name: 'cust_email', displayName: 'Customer Email' }],
    });
    const column = enriched.nodes.find((n) => n.type === 'column');

    expect(column?.name).toBe('Customer Email');
    expect(column?.id).toBe('iri-table::field::Customer Email');
  });

  it('should dedupe duplicate field names into a single node', () => {
    const enriched = enrichWithEntityFields(tableGraph, {
      fullyQualifiedName: 'db.schema.CUSTOMERS',
      columns: [{ name: 'email' }, { name: 'email' }],
    });
    const columns = enriched.nodes.filter((n) => n.type === 'column');
    const hasColumnLinks = enriched.links.filter(
      (l) => l.label === 'Has column'
    );

    expect(columns).toHaveLength(1);
    expect(hasColumnLinks).toHaveLength(1);
  });
});

describe('adaptRdfGraph edge robustness', () => {
  it('should drop an edge that references a node id missing from nodes', () => {
    const { links } = adaptRdfGraph({
      nodes: [
        { id: 'A', label: 'A', type: 'table' },
        { id: 'B', label: 'B', type: 'table' },
      ],
      edges: [
        { from: 'A', to: 'B', label: 'downstream' },
        { from: 'A', to: 'GHOST', label: 'downstream' },
        { from: 'GHOST', to: 'B', label: 'downstream' },
      ],
    });

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ source: 'A', target: 'B' });
  });

  it('should collapse two identical edges into exactly one link', () => {
    const { links } = adaptRdfGraph({
      nodes: [
        { id: 'A', label: 'A', type: 'table' },
        { id: 'B', label: 'B', type: 'table' },
      ],
      edges: [
        { from: 'A', to: 'B', label: 'downstream' },
        { from: 'A', to: 'B', label: 'downstream' },
      ],
    });

    expect(links).toHaveLength(1);
  });

  it('should not throw and return empty links when edges is undefined', () => {
    const result = adaptRdfGraph({
      nodes: [{ id: 'A', label: 'A', type: 'table' }],
    } as GraphData);

    expect(result.nodes).toHaveLength(1);
    expect(result.links).toEqual([]);
  });

  it('should return an empty graph when both nodes and edges are empty', () => {
    expect(adaptRdfGraph({ nodes: [], edges: [] })).toEqual({
      nodes: [],
      links: [],
    });
  });
});

describe('relationsOf multi-hop shared concept', () => {
  const MULTI_HOP: GraphData = {
    nodes: [
      { id: 'TA', label: 'ACCOUNTS', type: 'table' },
      { id: 'TB', label: 'INVOICES', type: 'table' },
      { id: 'CA', label: 'Account', type: 'glossaryTerm' },
      { id: 'CB', label: 'Invoice', type: 'glossaryTerm' },
    ],
    edges: [
      { from: 'TA', to: 'CA', label: 'mappedTo' },
      { from: 'TB', to: 'CB', label: 'mappedTo' },
      { from: 'CA', to: 'CB', label: 'relatedTo' },
    ],
  };

  it('should relate two tables across an ontology hop between their concepts', () => {
    const graph = adaptRdfGraph(MULTI_HOP);
    const relations = relationsOf(graph, 'TA');

    expect(relations.shared.map((r) => r.asset.id)).toEqual(['TB']);
    expect(relations.shared[0].via).toBe('Invoice');
    expect(relations.shared[0].path).toBe('Account → Invoice');
  });
});

describe('humanizeLabel via classifyEdge fallback', () => {
  it('should humanize an unknown raw label that does not touch a concept', () => {
    expect(classifyEdge('some_weird-Label', 'table', 'table')).toEqual({
      kind: 'technical',
      label: 'Some weird label',
    });
  });

  it('should fall back to an empty technical label for an empty raw label', () => {
    expect(classifyEdge('', 'table', 'table')).toEqual({
      kind: 'technical',
      label: '',
    });
  });
});
