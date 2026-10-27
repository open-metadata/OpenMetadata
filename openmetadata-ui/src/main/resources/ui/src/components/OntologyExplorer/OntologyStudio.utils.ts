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

import { isEqual } from 'lodash';
import serviceQuerySettings from '../../../../../../../../openmetadata-service/src/main/resources/json/data/settings/sparqlQuerySettings.json';
import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import type { SavedSparqlQuery } from '../../rest/rdfAPI';
import { getNameFromFQN } from '../../utils/FqnUtils';
import {
  GraphFilters,
  OntologyGraphData,
  OntologyNode,
} from './OntologyExplorer.interface';
import {
  isTermNode,
  METRIC_NODE_TYPE,
  METRIC_RELATION_TYPE,
} from './utils/graphBuilders';
import { isHierarchicalRelationship } from './utils/relationshipTypeUtils';

export interface OntologyHealthSummary {
  connectedPercent: number;
  connectedTermCount: number;
  isolatedTerms: OntologyNode[];
  totalTermCount: number;
}

export interface OntologyTermLabelSource {
  displayName?: string;
  fullyQualifiedName?: string;
  id: string;
  label?: string;
  name?: string;
}

export interface OntologyTreeRow {
  depth: number;
  isIsolated: boolean;
  node: OntologyNode;
  parentCount: number;
  relationCount: number;
}

export interface OntologyTreeItem extends OntologyTreeRow {
  children: OntologyTreeItem[];
}

export interface OntologyTreeMetric {
  measures: OntologyNode[];
  node: OntologyNode;
}

export interface OntologyTreeGroup {
  glossaryId: string;
  glossaryName: string;
  rows: OntologyTreeRow[];
}

export interface OntologyQuerySuggestion {
  id: string;
  label: string;
  query: string;
}

export const ONTOLOGY_SPARQL_PREFIXES =
  'PREFIX om: <https://open-metadata.org/ontology/>';

export const NEW_ONTOLOGY_QUERY = `${ONTOLOGY_SPARQL_PREFIXES}

SELECT ?conceptFqn WHERE {
  ?concept a om:GlossaryTerm ;
           om:fullyQualifiedName ?conceptFqn .
}
LIMIT 100`;

export const isCanonicalGlossaryQueryTemplate = (
  template: SavedSparqlQuery
): boolean =>
  serviceQuerySettings.queryTemplates.some((seed) => isEqual(template, seed));

// A native ontology's endpoint reads only its active release, which holds OWL classes, not glossary terms.
export const NEW_NATIVE_ONTOLOGY_QUERY = `PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?concept ?label WHERE {
  ?concept a owl:Class .
  OPTIONAL { ?concept rdfs:label ?label }
}
ORDER BY ?concept
LIMIT 100`;

const ONTOLOGY_NAMESPACE = 'https://open-metadata.org/ontology/';
const RDF_NAMESPACES: Record<string, string> = {
  om: ONTOLOGY_NAMESPACE,
  owl: 'http://www.w3.org/2002/07/owl#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
};
const MAX_ONTOLOGY_QUERY_SUGGESTIONS = 3;

export function resolveOntologyTermLabel(
  term: OntologyTermLabelSource
): string {
  const fullyQualifiedNameLabel = term.fullyQualifiedName
    ? getNameFromFQN(term.fullyQualifiedName)
    : undefined;
  const candidates = [
    term.displayName,
    term.name,
    term.label,
    fullyQualifiedNameLabel,
  ];
  const resolved = candidates
    .map((candidate) => candidate?.trim())
    .find((candidate) => candidate && candidate !== term.id);

  return resolved ?? term.id;
}

function escapeSparqlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function getRdfPredicate(
  relationType: string,
  relationDefinition?: RelationshipType
): string {
  const configuredPredicate = relationDefinition?.rdfPredicate;
  if (configuredPredicate?.match(/^https?:\/\//)) {
    return `<${configuredPredicate.replace(/>/g, '%3E')}>`;
  }
  if (configuredPredicate) {
    const [prefix, localName] = configuredPredicate.split(':', 2);
    const namespace = RDF_NAMESPACES[prefix];
    if (namespace && localName) {
      return `<${namespace}${localName}>`;
    }
  }

  return `<${ONTOLOGY_NAMESPACE}${encodeURIComponent(relationType)}>`;
}

export function buildOntologyQuerySuggestions(
  graphData: OntologyGraphData | null,
  selectedGlossaryIds: string[],
  relationTypes: RelationshipType[],
  limit = MAX_ONTOLOGY_QUERY_SUGGESTIONS
): OntologyQuerySuggestion[] {
  if (!graphData || limit <= 0) {
    return [];
  }
  const selectedGlossaries = new Set(selectedGlossaryIds);
  const nodesById = new Map(
    graphData.nodes.filter(isTermNode).map((node) => [node.id, node])
  );
  const relationTypeByName = new Map(
    relationTypes.map((relationType) => [relationType.name, relationType])
  );
  const candidates = graphData.edges
    .map((edge) => ({
      edge,
      fromNode: nodesById.get(edge.from),
      toNode: nodesById.get(edge.to),
      relationDefinition: relationTypeByName.get(edge.relationType),
    }))
    .filter((candidate) => {
      const isConnectedCandidate =
        candidate.edge.relationType !== 'parentOf' &&
        candidate.fromNode !== undefined &&
        candidate.toNode?.fullyQualifiedName !== undefined;

      return (
        isConnectedCandidate &&
        (selectedGlossaries.size === 0 ||
          (candidate.fromNode?.glossaryId !== undefined &&
            selectedGlossaries.has(candidate.fromNode.glossaryId)))
      );
    })
    .sort((left, right) => {
      const leftRelation =
        left.relationDefinition?.displayName ?? left.edge.label;
      const rightRelation =
        right.relationDefinition?.displayName ?? right.edge.label;

      return (
        leftRelation.localeCompare(rightRelation) ||
        (left.toNode?.label ?? '').localeCompare(right.toNode?.label ?? '') ||
        (left.fromNode?.label ?? '').localeCompare(right.fromNode?.label ?? '')
      );
    });
  const suggestions: typeof candidates = [];
  const selectedEdgeKeys = new Set<string>();
  const selectedRelationTypes = new Set<string>();
  const addCandidate = (candidate: (typeof candidates)[number]) => {
    const edgeKey = `${candidate.edge.from}:${candidate.edge.to}:${candidate.edge.relationType}`;
    if (suggestions.length >= limit || selectedEdgeKeys.has(edgeKey)) {
      return;
    }
    selectedEdgeKeys.add(edgeKey);
    selectedRelationTypes.add(candidate.edge.relationType);
    suggestions.push(candidate);
  };

  candidates.forEach((candidate) => {
    if (!selectedRelationTypes.has(candidate.edge.relationType)) {
      addCandidate(candidate);
    }
  });
  candidates.forEach(addCandidate);

  return suggestions.map(
    ({ edge, toNode, relationDefinition }): OntologyQuerySuggestion => {
      const relationLabel = relationDefinition?.displayName ?? edge.label;
      const targetFqn = toNode?.fullyQualifiedName ?? '';
      const predicate = getRdfPredicate(edge.relationType, relationDefinition);

      return {
        id: `ontology-${edge.relationType}-${edge.to}`.replace(
          /[^a-zA-Z0-9-]/g,
          '-'
        ),
        label: `${relationLabel}: ${toNode?.label ?? targetFqn}`,
        query: `${ONTOLOGY_SPARQL_PREFIXES}

SELECT ?conceptFqn WHERE {
  ?concept ${predicate} ?relatedConcept ;
           om:fullyQualifiedName ?conceptFqn .
  ?relatedConcept om:fullyQualifiedName "${escapeSparqlString(targetFqn)}" .
}
LIMIT 100`,
      };
    }
  );
}

function normalizeRelationType(relationType: string): string {
  return relationType.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function selectedGlossaryIds(filters: GraphFilters): Set<string> {
  return new Set(
    filters.glossaryIds.filter(
      (glossaryId) => glossaryId && glossaryId !== 'all'
    )
  );
}

function scopedTerms(
  graphData: OntologyGraphData | null,
  filters: GraphFilters
): OntologyNode[] {
  if (!graphData) {
    return [];
  }
  const glossaryIds = selectedGlossaryIds(filters);

  return graphData.nodes.filter(
    (node) =>
      isTermNode(node) &&
      (glossaryIds.size === 0 ||
        (node.glossaryId !== undefined && glossaryIds.has(node.glossaryId)))
  );
}

function termRelations(graphData: OntologyGraphData, termIds: Set<string>) {
  // Both directions of one stored relation (partOf / hasPart) arrive as edges
  // sharing the relation id; it is still one relation.
  const relationIds = new Set<string>();

  return graphData.edges.filter((edge) => {
    if (!termIds.has(edge.from) || !termIds.has(edge.to)) {
      return false;
    }
    if (edge.id) {
      if (relationIds.has(edge.id)) {
        return false;
      }
      relationIds.add(edge.id);
    }

    return true;
  });
}

export function getOntologyHealthSummary(
  graphData: OntologyGraphData | null,
  filters: GraphFilters
): OntologyHealthSummary {
  const terms = scopedTerms(graphData, filters);
  if (!graphData || terms.length === 0) {
    return {
      connectedPercent: 0,
      connectedTermCount: 0,
      isolatedTerms: terms,
      totalTermCount: terms.length,
    };
  }
  const termIds = new Set(terms.map((term) => term.id));
  const connectedIds = new Set<string>();
  termRelations(graphData, termIds).forEach((edge) => {
    if (termIds.has(edge.from)) {
      connectedIds.add(edge.from);
    }
    if (termIds.has(edge.to)) {
      connectedIds.add(edge.to);
    }
  });
  const isolatedTerms = terms
    .filter((term) => !connectedIds.has(term.id))
    .sort((left, right) => left.label.localeCompare(right.label));
  const connectedTermCount = terms.length - isolatedTerms.length;

  return {
    connectedPercent: Math.round((connectedTermCount / terms.length) * 100),
    connectedTermCount,
    isolatedTerms,
    totalTermCount: terms.length,
  };
}

// Hierarchical relation names (normalized) by edge direction. The inverse of a
// child-to-parent relation points from the parent, so it must not make the
// parent a child.
const PARENT_TO_CHILD_RELATIONS = new Set([
  'parentof',
  'narrower',
  'haspart',
  'superclassof',
]);
const CHILD_TO_PARENT_RELATIONS = new Set(['broader', 'isa', 'subclassof']);

function buildParentMap(
  graphData: OntologyGraphData,
  termIds: Set<string>,
  relationTypes: RelationshipType[]
): Map<string, Set<string>> {
  const parentMap = new Map<string, Set<string>>();
  const hierarchicalTypes = new Set(
    relationTypes
      .filter(isHierarchicalRelationship)
      .map((relationType) => normalizeRelationType(relationType.name))
  );
  const addParent = (childId: string, parentId: string) => {
    const parents = parentMap.get(childId) ?? new Set<string>();
    parents.add(parentId);
    parentMap.set(childId, parents);
  };

  graphData.edges.forEach((edge) => {
    if (!termIds.has(edge.from) || !termIds.has(edge.to)) {
      return;
    }
    const relationType = normalizeRelationType(edge.relationType);
    if (PARENT_TO_CHILD_RELATIONS.has(relationType)) {
      addParent(edge.to, edge.from);
    } else if (
      CHILD_TO_PARENT_RELATIONS.has(relationType) ||
      hierarchicalTypes.has(relationType)
    ) {
      addParent(edge.from, edge.to);
    }
  });

  return parentMap;
}

function resolvePrimaryParent(
  nodeId: string,
  parentMap: Map<string, Set<string>>,
  nodeById: Map<string, OntologyNode>
): string | undefined {
  return [...(parentMap.get(nodeId) ?? [])]
    .filter((parentId) => nodeById.has(parentId))
    .sort((left, right) => {
      const leftLabel = nodeById.get(left)?.label ?? left;
      const rightLabel = nodeById.get(right)?.label ?? right;

      return leftLabel.localeCompare(rightLabel);
    })[0];
}

type UnplacedTreeRow = Omit<OntologyTreeRow, 'depth'>;

const compareByLabel = (left: UnplacedTreeRow, right: UnplacedTreeRow) =>
  left.node.label.localeCompare(right.node.label);

// Depth-first, so each row is followed by its own subtree. Depth counts
// ancestors inside the glossary, so a row whose primary parent is in another
// glossary starts a subtree of its own at the root.
function orderAsTree(
  rows: UnplacedTreeRow[],
  primaryParentOf: (nodeId: string) => string | undefined
): OntologyTreeRow[] {
  const rowIds = new Set(rows.map((row) => row.node.id));
  const childrenOf = new Map<string, UnplacedTreeRow[]>();
  const roots: UnplacedTreeRow[] = [];
  rows.forEach((row) => {
    const parentId = primaryParentOf(row.node.id);
    if (!parentId || !rowIds.has(parentId)) {
      roots.push(row);

      return;
    }
    const siblings = childrenOf.get(parentId);
    if (siblings) {
      siblings.push(row);
    } else {
      childrenOf.set(parentId, [row]);
    }
  });
  const ordered: OntologyTreeRow[] = [];
  const visited = new Set<string>();
  const visit = (row: UnplacedTreeRow, depth: number) => {
    if (visited.has(row.node.id)) {
      return;
    }
    visited.add(row.node.id);
    ordered.push({ ...row, depth });
    childrenOf
      .get(row.node.id)
      ?.sort(compareByLabel)
      .forEach((child) => visit(child, depth + 1));
  };
  roots.sort(compareByLabel).forEach((root) => visit(root, 0));
  // Rows on a parent cycle never hang from a root; keep them visible.
  rows
    .filter((row) => !visited.has(row.node.id))
    .sort(compareByLabel)
    .forEach((row) => visit(row, 0));

  return ordered;
}

export function buildOntologyTreeGroups(
  graphData: OntologyGraphData | null,
  filters: GraphFilters,
  glossaries: Glossary[],
  relationTypes: RelationshipType[]
): OntologyTreeGroup[] {
  const terms = scopedTerms(graphData, filters);
  if (!graphData || terms.length === 0) {
    return [];
  }
  const termIds = new Set(terms.map((term) => term.id));
  const nodeById = new Map(terms.map((term) => [term.id, term]));
  const relationCounts = new Map<string, number>();
  termRelations(graphData, termIds).forEach((edge) => {
    if (termIds.has(edge.from)) {
      relationCounts.set(edge.from, (relationCounts.get(edge.from) ?? 0) + 1);
    }
    if (termIds.has(edge.to)) {
      relationCounts.set(edge.to, (relationCounts.get(edge.to) ?? 0) + 1);
    }
  });
  const parentMap = buildParentMap(graphData, termIds, relationTypes);
  const glossaryNameById = new Map(
    glossaries.map((glossary) => [
      glossary.id,
      glossary.displayName || glossary.name,
    ])
  );
  const groups = new Map<string, UnplacedTreeRow[]>();

  terms.forEach((term) => {
    const glossaryId = term.glossaryId ?? term.group ?? '';
    const rows = groups.get(glossaryId) ?? [];
    const relationCount = relationCounts.get(term.id) ?? 0;
    rows.push({
      isIsolated: relationCount === 0,
      node: term,
      parentCount: parentMap.get(term.id)?.size ?? 0,
      relationCount,
    });
    groups.set(glossaryId, rows);
  });

  return [...groups.entries()]
    .map(([glossaryId, rows]) => ({
      glossaryId,
      glossaryName:
        glossaryNameById.get(glossaryId) ?? rows[0]?.node.group ?? glossaryId,
      rows: orderAsTree(rows, (nodeId) =>
        resolvePrimaryParent(nodeId, parentMap, nodeById)
      ),
    }))
    .sort((left, right) => left.glossaryName.localeCompare(right.glossaryName));
}

// Turns depth-ordered rows (each followed by its subtree) back into a nested tree.
export function nestTreeRows(rows: OntologyTreeRow[]): OntologyTreeItem[] {
  const roots: OntologyTreeItem[] = [];
  const path: OntologyTreeItem[] = [];
  rows.forEach((row) => {
    const item: OntologyTreeItem = { ...row, children: [] };
    path.length = Math.min(path.length, row.depth);
    const parent = path[path.length - 1];
    (parent ? parent.children : roots).push(item);
    path.push(item);
  });

  return roots;
}

export function buildOntologyTreeMetrics(
  graphData: OntologyGraphData | null,
  filters: GraphFilters
): OntologyTreeMetric[] {
  const termById = new Map(
    scopedTerms(graphData, filters).map((term) => [term.id, term])
  );
  const measuresOf = new Map<string, OntologyNode[]>();
  graphData?.edges.forEach((edge) => {
    const term = termById.get(edge.to);
    if (edge.relationType === METRIC_RELATION_TYPE && term) {
      measuresOf.set(edge.from, [...(measuresOf.get(edge.from) ?? []), term]);
    }
  });

  return (graphData?.nodes ?? [])
    .filter((node) => node.type === METRIC_NODE_TYPE && measuresOf.has(node.id))
    .map((node) => ({ measures: measuresOf.get(node.id) ?? [], node }))
    .sort((left, right) => left.node.label.localeCompare(right.node.label));
}

export interface NativeTreeIndex {
  nodes: ReadonlyMap<string, OntologyNode>;
  parents: ReadonlyMap<string, readonly string[]>;
  children: ReadonlyMap<string, readonly string[]>;
  roots: readonly string[];
  relationCounts: ReadonlyMap<string, number>;
  health: OntologyHealthSummary;
}

export interface NativeTreePlacement extends OntologyTreeRow {
  key: string;
  path: readonly string[];
  otherParents: readonly OntologyNode[];
  hasChildren: boolean;
}

export interface NativeTreeCursor {
  frames: readonly { conceptId: string; childIndex: number }[];
}

export interface NativeTreeDisclosure {
  expanded: boolean;
  overrides: ReadonlyMap<string, boolean>;
}

export interface NativeTreePage {
  placements: readonly NativeTreePlacement[];
  context: readonly NativeTreePlacement[];
  previous?: NativeTreeCursor;
  next?: NativeTreeCursor;
}

// ADR:2026-10-24-ontology-studio-bounds-tree-windows-and-count-workers
export const NATIVE_TREE_WINDOW_SIZE = 2048;

function visitNativeTree(
  id: string,
  children: ReadonlyMap<string, readonly string[]>,
  visited: Set<string>,
  finished: string[]
) {
  const stack = [{ id, next: 0 }];
  visited.add(id);
  while (stack.length) {
    const frame = stack[stack.length - 1];
    const child = children.get(frame.id)?.[frame.next++];
    if (child === undefined) {
      finished.push(frame.id);
      stack.pop();
    } else if (!visited.has(child)) {
      visited.add(child);
      stack.push({ id: child, next: 0 });
    }
  }
}

function nativeTreeComponent(
  id: string,
  number: number,
  parents: ReadonlyMap<string, readonly string[]>,
  component: Map<string, number>,
  compare: (a: string, b: string) => number
): string {
  const pending = [id];
  let representative = id;
  component.set(id, number);
  for (let position = 0; position < pending.length; position++) {
    const current = pending[position];
    if (compare(current, representative) < 0) {
      representative = current;
    }
    for (const parent of parents.get(current) ?? []) {
      if (!component.has(parent)) {
        component.set(parent, number);
        pending.push(parent);
      }
    }
  }

  return representative;
}

function nativeTreeRoots(
  nodes: ReadonlyMap<string, OntologyNode>,
  parents: ReadonlyMap<string, readonly string[]>,
  children: ReadonlyMap<string, readonly string[]>,
  compare: (a: string, b: string) => number
): string[] {
  const visited = new Set<string>();
  const finished: string[] = [];
  for (const id of nodes.keys()) {
    if (!visited.has(id)) {
      visitNativeTree(id, children, visited, finished);
    }
  }
  const component = new Map<string, number>();
  const representatives: string[] = [];
  for (const id of finished.reverse()) {
    if (!component.has(id)) {
      representatives.push(
        nativeTreeComponent(
          id,
          representatives.length,
          parents,
          component,
          compare
        )
      );
    }
  }
  const incoming = new Set<number | undefined>();
  parents.forEach((owners, child) =>
    owners.forEach((parent) => {
      if (component.get(child) !== component.get(parent)) {
        incoming.add(component.get(child));
      }
    })
  );
  const roots = [...nodes.keys()].filter((id) => !parents.get(id)?.length);
  const rootIds = new Set(roots);

  return [
    ...roots,
    ...representatives
      .filter((id, number) => !incoming.has(number) && !rootIds.has(id))
      .sort(compare),
  ];
}

export function buildNativeTreeIndex(
  graphData: OntologyGraphData | null,
  filters: GraphFilters,
  relationTypes: RelationshipType[]
): NativeTreeIndex {
  const terms = scopedTerms(graphData, filters).sort(
    (left, right) =>
      (left.group ?? '').localeCompare(right.group ?? '') ||
      left.label.localeCompare(right.label) ||
      left.id.localeCompare(right.id)
  );
  const nodes = new Map(terms.map((node) => [node.id, node]));
  const ids = new Set(nodes.keys());
  const parentMap = graphData
    ? buildParentMap(graphData, ids, relationTypes)
    : new Map<string, Set<string>>();
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const rank = new Map(terms.map((node, position) => [node.id, position]));
  const compare = (left: string, right: string) =>
    (rank.get(left) ?? 0) - (rank.get(right) ?? 0);
  for (const node of terms) {
    parents.set(
      node.id,
      [...(parentMap.get(node.id) ?? [])]
        .filter((id) => {
          const parent = nodes.get(id);

          return (
            parent &&
            (parent.glossaryId ?? parent.group) ===
              (node.glossaryId ?? node.group)
          );
        })
        .sort(compare)
    );
    children.set(node.id, []);
  }
  for (const [child, owners] of parents) {
    for (const parent of owners) {
      children.get(parent)?.push(child);
    }
  }
  const roots = nativeTreeRoots(nodes, parents, children, compare);
  const relationCounts = new Map<string, number>();
  for (const edge of graphData ? termRelations(graphData, ids) : []) {
    relationCounts.set(edge.from, (relationCounts.get(edge.from) ?? 0) + 1);
    relationCounts.set(edge.to, (relationCounts.get(edge.to) ?? 0) + 1);
  }

  return {
    nodes,
    parents,
    children,
    roots,
    relationCounts,
    health: getOntologyHealthSummary(graphData, filters),
  };
}

export function nativeTreePlacementKey(
  index: NativeTreeIndex,
  path: readonly string[]
): string {
  const node = index.nodes.get(path[0]);

  return JSON.stringify([node?.glossaryId ?? node?.group ?? '', ...path]);
}

export function nativeTreeCursorForPath(
  index: NativeTreeIndex,
  path: readonly string[]
): NativeTreeCursor {
  return {
    frames: path.map((conceptId, position) => ({
      conceptId,
      childIndex: (position
        ? index.children.get(path[position - 1]) ?? []
        : index.roots
      ).indexOf(conceptId),
    })),
  };
}

export function findNativeTreePath(
  index: NativeTreeIndex,
  conceptId: string
): string[] | undefined {
  const preceding = new Map<string, string | undefined>();
  const queue = [...index.roots];
  for (const root of queue) {
    preceding.set(root, undefined);
  }
  for (let position = 0; position < queue.length; position++) {
    const id = queue[position];
    if (id === conceptId) {
      const path: string[] = [];
      let current: string | undefined = id;
      while (current !== undefined) {
        path.push(current);
        current = preceding.get(current);
      }

      return path.reverse();
    }
    for (const child of index.children.get(id) ?? []) {
      if (!preceding.has(child)) {
        preceding.set(child, id);
        queue.push(child);
      }
    }
  }

  return undefined;
}

export function isNativeTreeExpanded(
  disclosure: NativeTreeDisclosure,
  key: string
): boolean {
  return disclosure.overrides.get(key) ?? disclosure.expanded;
}

function adjacentNativeFrame(
  index: NativeTreeIndex,
  path: readonly string[],
  start: number,
  step: number
) {
  const siblings = path.length
    ? index.children.get(path[path.length - 1]) ?? []
    : index.roots;
  const ancestors = new Set(path);
  for (
    let childIndex = start;
    childIndex >= 0 && childIndex < siblings.length;
    childIndex += step
  ) {
    const conceptId = siblings[childIndex];
    if (!ancestors.has(conceptId)) {
      return { conceptId, childIndex };
    }
  }

  return undefined;
}

function appendNativeChild(
  index: NativeTreeIndex,
  disclosure: NativeTreeDisclosure,
  frames: { conceptId: string; childIndex: number }[],
  step: number
): boolean {
  const path = frames.map(({ conceptId }) => conceptId);
  if (!isNativeTreeExpanded(disclosure, nativeTreePlacementKey(index, path))) {
    return false;
  }
  const childCount = index.children.get(path[path.length - 1])?.length ?? 0;
  const child = adjacentNativeFrame(
    index,
    path,
    step === 1 ? 0 : childCount - 1,
    step
  );
  if (!child) {
    return false;
  }
  frames.push(child);

  return true;
}

function lastNativeDescendant(
  index: NativeTreeIndex,
  disclosure: NativeTreeDisclosure,
  frames: { conceptId: string; childIndex: number }[]
): NativeTreeCursor {
  let descending = true;
  while (descending) {
    descending = appendNativeChild(index, disclosure, frames, -1);
  }

  return { frames };
}

function moveNativeTreeCursor(
  index: NativeTreeIndex,
  disclosure: NativeTreeDisclosure,
  cursor: NativeTreeCursor,
  direction: 'forward' | 'backward'
): NativeTreeCursor | undefined {
  const frames = cursor.frames.map((frame) => ({ ...frame }));
  const step = direction === 'forward' ? 1 : -1;
  if (step === 1 && appendNativeChild(index, disclosure, frames, step)) {
    return { frames };
  }
  let frame = frames.pop();
  while (frame) {
    const sibling = adjacentNativeFrame(
      index,
      frames.map(({ conceptId }) => conceptId),
      frame.childIndex + step,
      step
    );
    if (sibling) {
      frames.push(sibling);

      return step === -1
        ? lastNativeDescendant(index, disclosure, frames)
        : { frames };
    }
    if (step === -1) {
      return frames.length ? { frames } : undefined;
    }
    frame = frames.pop();
  }

  return undefined;
}

function nativeTreePlacement(
  index: NativeTreeIndex,
  path: readonly string[]
): NativeTreePlacement {
  const id = path[path.length - 1];
  const node = index.nodes.get(id);
  if (!node) {
    throw new Error('Invalid native tree cursor');
  }
  const parents = index.parents.get(id) ?? [];
  const ancestors = new Set(path);
  const relationCount = index.relationCounts.get(id) ?? 0;

  return {
    key: nativeTreePlacementKey(index, path),
    node,
    path,
    depth: path.length - 1,
    parentCount: parents.length,
    relationCount,
    isIsolated: relationCount === 0,
    hasChildren: (index.children.get(id) ?? []).some(
      (child) => !ancestors.has(child)
    ),
    otherParents: parents
      .filter((parent) => parent !== path[path.length - 2])
      .flatMap((parent) => {
        const other = index.nodes.get(parent);

        return other ? [other] : [];
      }),
  };
}

export function getNativeTreePage(
  index: NativeTreeIndex,
  disclosure: NativeTreeDisclosure,
  start?: NativeTreeCursor,
  direction: 'forward' | 'backward' = 'forward'
): NativeTreePage {
  let cursor =
    start ??
    (index.roots[0]
      ? nativeTreeCursorForPath(index, [index.roots[0]])
      : undefined);
  const placements: NativeTreePlacement[] = [];
  let first: NativeTreeCursor | undefined;
  let last: NativeTreeCursor | undefined;
  while (cursor && placements.length < NATIVE_TREE_WINDOW_SIZE) {
    first ??= cursor;
    last = cursor;
    placements.push(
      nativeTreePlacement(
        index,
        cursor.frames.map(({ conceptId }) => conceptId)
      )
    );
    cursor = moveNativeTreeCursor(index, disclosure, cursor, direction);
  }
  if (direction === 'backward') {
    placements.reverse();
    [first, last] = [last, first];
  }
  const context: NativeTreePlacement[] = [];
  const firstPath = placements[0]?.path ?? [];
  for (let depth = 1; depth < firstPath.length; depth++) {
    context.push(nativeTreePlacement(index, firstPath.slice(0, depth)));
  }

  return {
    placements,
    context,
    previous: first
      ? moveNativeTreeCursor(index, disclosure, first, 'backward')
      : undefined,
    next: last
      ? moveNativeTreeCursor(index, disclosure, last, 'forward')
      : undefined,
  };
}

export interface NativeTreeState {
  index: NativeTreeIndex;
  disclosure: NativeTreeDisclosure;
  anchor?: NativeTreeCursor;
  direction: 'forward' | 'backward';
  selectedId?: string;
  selectedKey?: string;
  reveal?: string;
}

export function revealNativeTreeSelection(
  index: NativeTreeIndex,
  selectedId?: string,
  previous?: NativeTreeState
): NativeTreeState {
  const disclosure =
    previous?.index === index
      ? previous.disclosure
      : { expanded: true, overrides: new Map<string, boolean>() };
  const path = selectedId ? findNativeTreePath(index, selectedId) : undefined;
  const overrides = new Map(disclosure.overrides);
  if (path) {
    for (let length = 1; length < path.length; length++) {
      overrides.set(nativeTreePlacementKey(index, path.slice(0, length)), true);
    }
  }
  const key = path ? nativeTreePlacementKey(index, path) : undefined;

  return {
    index,
    disclosure: { ...disclosure, overrides },
    anchor: path ? nativeTreeCursorForPath(index, path) : undefined,
    direction: 'forward',
    selectedId,
    selectedKey: key,
    reveal: key,
  };
}
