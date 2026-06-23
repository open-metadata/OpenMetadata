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

import { GraphData, GraphNode } from '../../rest/rdfAPI.interface';
import { ALL_LEVELS } from './KnowledgeGraph3D.constants';
import {
  Graph3DData,
  GraphLink3D,
  GraphNode3D,
  Level,
  LinkKind,
  NodeRelations,
  NodeType,
  RelationRow,
  SharedConceptRow,
} from './types';

const MAPPED_TO_LABEL = 'Mapped to';

/** RDF entity type string (normalized) -> renderer NodeType. Unknown types fall back to `table`. */
const RDF_TYPE_MAP: Record<string, NodeType> = {
  table: 'table',
  column: 'column',
  database: 'database',
  databaseschema: 'schema',
  schema: 'schema',
  dashboard: 'dashboard',
  dashboarddatamodel: 'dashboard',
  chart: 'chart',
  pipeline: 'pipeline',
  topic: 'topic',
  container: 'container',
  mlmodel: 'mlmodel',
  searchindex: 'searchIndex',
  storedprocedure: 'storedProcedure',
  metric: 'metric',
  custommetric: 'metric',
  apiendpoint: 'api',
  apicollection: 'api',
  query: 'query',
  // services (all connector services share the service glyph)
  service: 'service',
  databaseservice: 'service',
  messagingservice: 'service',
  dashboardservice: 'service',
  pipelineservice: 'service',
  mlmodelservice: 'service',
  storageservice: 'service',
  searchservice: 'service',
  metadataservice: 'service',
  driveservice: 'service',
  securityservice: 'service',
  apiservice: 'service',
  // drive / files
  file: 'file',
  spreadsheet: 'file',
  worksheet: 'file',
  directory: 'directory',
  // governance / quality
  glossaryterm: 'concept',
  glossary: 'concept',
  concept: 'concept',
  testcase: 'testCase',
  testsuite: 'testSuite',
  datacontract: 'dataContract',
  domain: 'domain',
  dataproduct: 'product',
  product: 'product',
  tag: 'tag',
  classification: 'tag',
  user: 'user',
  team: 'team',
};

/**
 * Recognised RDF relationship labels (normalized) -> a canonical label.
 *
 * These values are NOT shown directly: they are internal, stable identifiers
 * that every display site localizes through {@link RELATION_LABEL_KEYS} ->
 * `t(...)` (see the detail panels and the edge tooltip). A relation the user
 * defines themselves (e.g. a custom glossary relation) won't be in these maps;
 * it falls through to `humanizeLabel` and is shown as-is, since user-defined
 * names cannot be pre-translated. The `rdfGraphAdapter.test` suite guards that
 * every canonical value here has a matching `RELATION_LABEL_KEYS` entry.
 */
export const ONTOLOGY_LABELS: Record<string, string> = {
  mappedto: MAPPED_TO_LABEL,
  hasglossaryterm: MAPPED_TO_LABEL,
  glossaryterm: MAPPED_TO_LABEL,
  parentof: 'Parent of',
  childof: 'Child of',
  relatedto: 'Related to',
  related: 'Related to',
  isrelatedto: 'Related to',
  isa: 'Related to',
  isalso: 'Related to',
  synonym: 'Synonym',
  synonymof: 'Synonym',
  hassynonym: 'Synonym',
  broader: 'Broader / narrower',
  narrower: 'Broader / narrower',
  broadernarrower: 'Broader / narrower',
};

export const TECHNICAL_LABELS: Record<string, string> = {
  hascolumn: 'Has column',
  haslineage: 'Downstream',
  lineage: 'Downstream',
  upstream: 'Downstream',
  downstream: 'Downstream',
  upstreamof: 'Downstream',
  downstreamof: 'Downstream',
  ownedby: 'Owned by',
  hasowner: 'Owned by',
  owner: 'Owned by',
  ownedbyteam: 'Owned by team',
  createdby: 'Created by',
  updatedby: 'Updated by',
  steward: 'Steward',
  hassteward: 'Steward',
  belongsto: 'Belongs to',
  belongstoschema: 'Belongs to schema',
  belongstodatabase: 'Belongs to database',
  belongstoservice: 'Belongs to service',
  partof: 'Belongs to',
  inputport: 'Input port',
  partofdomain: 'Part of domain',
  hastag: 'Has tag',
  taggedwith: 'Has tag',
  mentionedin: 'Mentioned in',
  usedby: 'Mentioned in',
  usedin: 'Mentioned in',
  mentions: 'Mentioned in',
  memberof: 'Member of',
  dependson: 'Depends on',
  sharesconcepts: 'Shares concepts',
};

const OWNERSHIP_LABELS = new Set([
  'ownedby',
  'hasowner',
  'owner',
  'ownedbyteam',
  'createdby',
  'updatedby',
  'steward',
  'hassteward',
]);

const MEMBER_LABELS = new Set(['Input port', 'Part of domain']);

/**
 * i18n keys for the closed set of display labels emitted by `classifyEdge`.
 * The detail panel renders `t(RELATION_LABEL_KEYS[label])`; the `humanizeLabel`
 * fallback for unknown predicates has no entry and is rendered as-is.
 */
export const RELATION_LABEL_KEYS: Record<string, string> = {
  'Mapped to': 'label.mapped-to',
  'Parent of': 'label.parent-of',
  'Child of': 'label.child-of',
  'Related to': 'label.related-to',
  Synonym: 'label.synonym',
  'Broader / narrower': 'label.broader-narrower',
  'Has column': 'label.has-column',
  'Has field': 'label.has-field',
  Downstream: 'label.downstream',
  'Owned by': 'label.owned-by',
  'Owned by team': 'label.owned-by-team',
  'Created by': 'label.created-by',
  'Updated by': 'label.updated-by',
  Steward: 'label.steward',
  'Belongs to': 'label.belongs-to',
  'Belongs to schema': 'label.belongs-to-schema',
  'Belongs to database': 'label.belongs-to-database',
  'Belongs to service': 'label.belongs-to-service',
  'Input port': 'label.input-port',
  'Part of domain': 'label.part-of-domain',
  'Has tag': 'label.has-tag',
  'Mentioned in': 'label.mentioned-in',
  'Member of': 'label.member-of',
  'Depends on': 'label.depends-on',
  'Shares concepts': 'label.shares-concept-plural',
};

const LEVELS_BY_TYPE: Record<NodeType, Level[]> = {
  // asset-detail / structure / governance attachments — only meaningful at the asset level
  column: ['asset'],
  schema: ['asset'],
  database: ['asset'],
  service: ['asset'],
  query: ['asset'],
  tag: ['asset'],
  user: ['asset'],
  team: ['asset'],
  storedProcedure: ['asset'],
  testCase: ['asset'],
  testSuite: ['asset'],
  dataContract: ['asset'],
  file: ['asset'],
  directory: ['asset'],
  // data assets — roll up across all levels
  table: ['asset', 'product', 'domain'],
  dashboard: ['asset', 'product', 'domain'],
  pipeline: ['asset', 'product', 'domain'],
  topic: ['asset', 'product', 'domain'],
  container: ['asset', 'product', 'domain'],
  mlmodel: ['asset', 'product', 'domain'],
  searchIndex: ['asset', 'product', 'domain'],
  chart: ['asset', 'product', 'domain'],
  api: ['asset', 'product', 'domain'],
  metric: ['asset', 'product', 'domain'],
  concept: ['asset', 'product', 'domain'],
  product: ['product', 'domain'],
  domain: ['domain'],
};

const normalizeLabelKey = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9]/g, '');

export const normalizeNodeType = (rdfType: string): NodeType =>
  RDF_TYPE_MAP[normalizeLabelKey(rdfType)] ?? 'table';

const humanizeLabel = (label: string): string => {
  const spaced = label
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) {
    return label;
  }

  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

const intersectLevels = (a: Level[], b: Level[]): Level[] =>
  ALL_LEVELS.filter((level) => a.includes(level) && b.includes(level));

const idOf = (endpoint: string | GraphNode3D): string =>
  typeof endpoint === 'object' ? endpoint.id : endpoint;

export const classifyEdge = (
  rawLabel: string,
  sourceType: NodeType,
  targetType: NodeType
): { kind: LinkKind; label: string } => {
  const key = normalizeLabelKey(rawLabel);
  let result: { kind: LinkKind; label: string };
  const touchesConcept = sourceType === 'concept' || targetType === 'concept';

  if (ONTOLOGY_LABELS[key]) {
    result = { kind: 'ontology', label: ONTOLOGY_LABELS[key] };
  } else if (TECHNICAL_LABELS[key]) {
    result = { kind: 'technical', label: TECHNICAL_LABELS[key] };
  } else if (touchesConcept && !OWNERSHIP_LABELS.has(key)) {
    const bothConcepts = sourceType === 'concept' && targetType === 'concept';
    // A concept<->concept edge with an unrecognised predicate is a user-defined
    // glossary relation (e.g. "Regulates"): keep its humanized name rather than
    // collapsing every custom relation to a generic "Related to". A
    // concept<->asset edge is an asset-to-business-concept mapping.
    result = {
      kind: 'ontology',
      label: bothConcepts ? humanizeLabel(rawLabel) : MAPPED_TO_LABEL,
    };
  } else {
    result = { kind: 'technical', label: humanizeLabel(rawLabel) };
  }

  return result;
};

const toGraphNode = (node: GraphNode): GraphNode3D => {
  const type = normalizeNodeType(node.type);

  return {
    id: node.id,
    name: node.label,
    type,
    levels: LEVELS_BY_TYPE[type] ?? ['asset'],
    fullyQualifiedName: node.fullyQualifiedName,
    description: node.description,
  };
};

const buildLinks = (
  data: GraphData,
  byId: Map<string, GraphNode3D>
): GraphLink3D[] => {
  const seen = new Set<string>();
  const links: GraphLink3D[] = [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  edges.forEach((edge) => {
    const source = byId.get(edge.from);
    const target = byId.get(edge.to);
    if (!source || !target) {
      return;
    }
    const { kind, label } = classifyEdge(edge.label, source.type, target.type);
    const dedupeKey = `${edge.from}|${edge.to}|${label}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    links.push({
      source: edge.from,
      target: edge.to,
      label,
      kind,
      levels: intersectLevels(source.levels, target.levels),
    });
  });

  return links;
};

const markCoverage = (nodes: GraphNode3D[], links: GraphLink3D[]): void => {
  const mappedTables = new Set<string>();
  links.forEach((link) => {
    if (link.kind === 'ontology' && link.label === MAPPED_TO_LABEL) {
      // "Mapped to" links can be emitted in either direction (table->concept
      // for `mappedTo`, concept->table for `hasGlossaryTerm`/`glossaryTerm`), so
      // mark both endpoints; the concept id is harmless since only `table`
      // nodes consult this set below.
      mappedTables.add(idOf(link.source));
      mappedTables.add(idOf(link.target));
    }
  });
  nodes.forEach((node) => {
    if (node.type === 'table') {
      node.mapped = mappedTables.has(node.id);
    }
  });
};

/**
 * Maps the RDF `/rdf/graph/explore` response into the normalized 3D graph.
 * The RDF payload carries node `type` and edge `label` strings only; this
 * adapter derives the link `kind` (technical vs ontology), each node's
 * roll-up `levels`, and the table `mapped` coverage flag.
 */
export const adaptRdfGraph = (data: GraphData | null): Graph3DData => {
  let result: Graph3DData = { nodes: [], links: [] };
  const rawNodes = Array.isArray(data?.nodes) ? data.nodes : [];
  if (rawNodes.length > 0) {
    const nodes = rawNodes.map(toGraphNode);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const links = buildLinks(data as GraphData, byId);
    markCoverage(nodes, links);
    result = { nodes, links };
  }

  return result;
};

interface FieldLike {
  name?: string;
  displayName?: string;
}

/**
 * The subset of an entity the graph reads to derive column/field nodes. The
 * focus entity passed to {@link enrichWithEntityFields} (and the
 * KnowledgeGraph3D `entity` prop) carries these optionally depending on its
 * type (table/dashboardDataModel: `columns`; container: `dataModel.columns`;
 * topic: `messageSchema.schemaFields`; searchIndex: `fields`).
 */
export interface FieldCarrier {
  fullyQualifiedName?: string;
  columns?: FieldLike[];
  fields?: FieldLike[];
  dataModel?: { columns?: FieldLike[] };
  messageSchema?: { schemaFields?: FieldLike[] };
}

/**
 * Resolves the child fields of an asset across entity shapes: `columns`
 * (table / dashboardDataModel), `dataModel.columns` (container),
 * `messageSchema.schemaFields` (topic), `fields` (searchIndex).
 */
const extractEntityFields = (
  entity?: FieldCarrier
): { items: FieldLike[]; label: string } | null => {
  let result: { items: FieldLike[]; label: string } | null = null;
  if (entity?.columns?.length) {
    result = { items: entity.columns, label: 'Has column' };
  } else if (entity?.dataModel?.columns?.length) {
    result = { items: entity.dataModel.columns, label: 'Has column' };
  } else if (entity?.messageSchema?.schemaFields?.length) {
    result = { items: entity.messageSchema.schemaFields, label: 'Has field' };
  } else if (entity?.fields?.length) {
    result = { items: entity.fields, label: 'Has field' };
  }

  return result;
};

/**
 * The RDF graph does not emit column/field nodes, so enrich the focus entity
 * with its own child fields (already loaded on the entity) as `Has column` /
 * `Has field` technical links. Matches the focus node by fully-qualified name.
 * Gated by the "Show columns" toggle since fields add a lot of nodes.
 */
export const enrichWithEntityFields = (
  graph: Graph3DData,
  entity?: FieldCarrier
): Graph3DData => {
  let result = graph;
  const fields = extractEntityFields(entity);
  const focus =
    entity?.fullyQualifiedName && fields
      ? graph.nodes.find(
          (node) => node.fullyQualifiedName === entity.fullyQualifiedName
        )
      : undefined;
  if (focus && fields) {
    const seen = new Set(graph.nodes.map((node) => node.id));
    const nodes: GraphNode3D[] = [];
    const links: GraphLink3D[] = [];
    fields.items.forEach((field) => {
      const name = field.displayName || field.name;
      const id = `${focus.id}::field::${name}`;
      if (name && !seen.has(id)) {
        seen.add(id);
        nodes.push({ id, name, type: 'column', levels: ['asset'] });
        links.push({
          source: focus.id,
          target: id,
          label: fields.label,
          kind: 'technical',
          levels: ['asset'],
        });
      }
    });
    result = {
      nodes: [...graph.nodes, ...nodes],
      links: [...graph.links, ...links],
    };
  }

  return result;
};

const expandSharedConcepts = (
  links: GraphLink3D[],
  byId: Map<string, GraphNode3D>,
  myConcepts: Set<string>
): Map<string, string> => {
  const expanded = new Map<string, string>();
  const nameOf = (id: string): string => byId.get(id)?.name ?? id;
  myConcepts.forEach((conceptId) => expanded.set(conceptId, nameOf(conceptId)));
  links.forEach((link) => {
    if (link.kind !== 'ontology') {
      return;
    }
    const source = idOf(link.source);
    const target = idOf(link.target);
    if (
      myConcepts.has(source) &&
      !myConcepts.has(target) &&
      byId.get(target)?.type === 'concept' &&
      !expanded.has(target)
    ) {
      expanded.set(target, `${nameOf(source)} → ${nameOf(target)}`);
    }
    if (
      myConcepts.has(target) &&
      !myConcepts.has(source) &&
      byId.get(source)?.type === 'concept' &&
      !expanded.has(source)
    ) {
      expanded.set(source, `${nameOf(target)} → ${nameOf(source)}`);
    }
  });

  return expanded;
};

const collectSharedAssets = (
  links: GraphLink3D[],
  byId: Map<string, GraphNode3D>,
  expanded: Map<string, string>,
  selfId: string
): SharedConceptRow[] => {
  const seen = new Set<string>();
  const shared: SharedConceptRow[] = [];
  links.forEach((link) => {
    if (link.kind !== 'ontology' || link.label !== MAPPED_TO_LABEL) {
      return;
    }
    const source = idOf(link.source);
    const target = idOf(link.target);
    const asset = byId.get(source);
    if (
      expanded.has(target) &&
      asset?.type === 'table' &&
      source !== selfId &&
      !seen.has(source)
    ) {
      seen.add(source);
      shared.push({
        asset,
        via: byId.get(target)?.name ?? target,
        path: expanded.get(target) ?? '',
      });
    }
  });

  return shared;
};

const classifyRelationRow = (
  row: RelationRow,
  buckets: NodeRelations
): void => {
  if (row.kind === 'ontology') {
    if (row.label === MAPPED_TO_LABEL && row.direction === 'out') {
      buckets.mapped.push(row);
    } else {
      buckets.hierarchy.push(row);
    }
  } else if (MEMBER_LABELS.has(row.label) || /^Belongs to/.test(row.label)) {
    buckets.members.push(row);
  } else {
    buckets.technical.push(row);
  }
};

/**
 * Computes every relation of a node from the FULL graph (not the filtered
 * view) so the detail panel stays complete regardless of the active
 * level/lens. Ported from the reference `relationsOf`.
 */
export const relationsOf = (graph: Graph3DData, id: string): NodeRelations => {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const buckets: NodeRelations = {
    technical: [],
    hierarchy: [],
    members: [],
    mapped: [],
    shared: [],
    node: byId.get(id),
  };

  graph.links.forEach((link) => {
    const source = idOf(link.source);
    const target = idOf(link.target);
    if (source !== id && target !== id) {
      return;
    }
    const otherId = source === id ? target : source;
    const other = byId.get(otherId) ?? {
      id: otherId,
      name: otherId,
      type: 'table' as NodeType,
      levels: [],
    };
    classifyRelationRow(
      {
        label: link.label,
        other,
        direction: source === id ? 'out' : 'in',
        kind: link.kind,
      },
      buckets
    );
  });

  if (buckets.node?.type === 'table') {
    const myConcepts = new Set(buckets.mapped.map((row) => row.other.id));
    const expanded = expandSharedConcepts(graph.links, byId, myConcepts);
    buckets.shared = collectSharedAssets(graph.links, byId, expanded, id);
  }

  return buckets;
};
