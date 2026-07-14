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

import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';
import {
  GraphFilters,
  OntologyGraphData,
  OntologyNode,
} from './OntologyExplorer.interface';
import { isTermNode } from './utils/graphBuilders';

export interface OntologyHealthSummary {
  connectedPercent: number;
  connectedTermCount: number;
  isolatedTerms: OntologyNode[];
  totalTermCount: number;
}

export interface OntologyTreeRow {
  depth: number;
  isIsolated: boolean;
  node: OntologyNode;
  parentCount: number;
  relationCount: number;
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
export const ONTOLOGY_KNOWLEDGE_GRAPH =
  'https://open-metadata.org/graph/knowledge';

export const NEW_ONTOLOGY_QUERY = `${ONTOLOGY_SPARQL_PREFIXES}

SELECT ?conceptFqn WHERE {
  GRAPH <${ONTOLOGY_KNOWLEDGE_GRAPH}> {
    ?concept a om:GlossaryTerm ;
             om:fullyQualifiedName ?conceptFqn .
  }
}
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

function escapeSparqlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function getRdfPredicate(
  relationType: string,
  relationDefinition?: GlossaryTermRelationType
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
  relationTypes: GlossaryTermRelationType[],
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
    .filter(
      (candidate) =>
        candidate.edge.relationType !== 'parentOf' &&
        candidate.fromNode !== undefined &&
        candidate.toNode?.fullyQualifiedName !== undefined &&
        (selectedGlossaries.size === 0 ||
          (candidate.fromNode.glossaryId !== undefined &&
            selectedGlossaries.has(candidate.fromNode.glossaryId)))
    )
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
  GRAPH <${ONTOLOGY_KNOWLEDGE_GRAPH}> {
    ?concept ${predicate} ?relatedConcept ;
             om:fullyQualifiedName ?conceptFqn .
    ?relatedConcept om:fullyQualifiedName "${escapeSparqlString(targetFqn)}" .
  }
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
  return graphData.edges.filter(
    (edge) => termIds.has(edge.from) && termIds.has(edge.to)
  );
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

function buildParentMap(
  graphData: OntologyGraphData,
  termIds: Set<string>,
  relationTypes: GlossaryTermRelationType[]
): Map<string, Set<string>> {
  const parentMap = new Map<string, Set<string>>();
  const hierarchicalTypes = new Set(
    relationTypes
      .filter((relationType) => relationType.category === 'hierarchical')
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
    if (relationType === 'parentof' || relationType === 'narrower') {
      addParent(edge.to, edge.from);
    } else if (
      relationType === 'broader' ||
      relationType === 'isa' ||
      relationType === 'subclassof' ||
      hierarchicalTypes.has(relationType)
    ) {
      addParent(edge.from, edge.to);
    }
  });

  return parentMap;
}

function buildDepthResolver(
  parentMap: Map<string, Set<string>>,
  nodeById: Map<string, OntologyNode>
) {
  const depthCache = new Map<string, number>();

  const resolveDepth = (nodeId: string, path = new Set<string>()): number => {
    const cached = depthCache.get(nodeId);
    if (cached !== undefined) {
      return cached;
    }
    if (path.has(nodeId) || path.size >= 16) {
      return 0;
    }
    const nextPath = new Set(path).add(nodeId);
    const primaryParent = [...(parentMap.get(nodeId) ?? [])]
      .filter((parentId) => nodeById.has(parentId))
      .sort((left, right) => {
        const leftLabel = nodeById.get(left)?.label ?? left;
        const rightLabel = nodeById.get(right)?.label ?? right;

        return leftLabel.localeCompare(rightLabel);
      })[0];
    const depth = primaryParent
      ? Math.min(16, resolveDepth(primaryParent, nextPath) + 1)
      : 0;
    depthCache.set(nodeId, depth);

    return depth;
  };

  return resolveDepth;
}

export function buildOntologyTreeGroups(
  graphData: OntologyGraphData | null,
  filters: GraphFilters,
  glossaries: Glossary[],
  relationTypes: GlossaryTermRelationType[]
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
  const resolveDepth = buildDepthResolver(parentMap, nodeById);
  const glossaryNameById = new Map(
    glossaries.map((glossary) => [
      glossary.id,
      glossary.displayName || glossary.name,
    ])
  );
  const groups = new Map<string, OntologyTreeRow[]>();

  terms.forEach((term) => {
    const glossaryId = term.glossaryId ?? term.group ?? '';
    const rows = groups.get(glossaryId) ?? [];
    const relationCount = relationCounts.get(term.id) ?? 0;
    rows.push({
      depth: resolveDepth(term.id),
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
      rows: rows.sort(
        (left, right) =>
          left.depth - right.depth ||
          left.node.label.localeCompare(right.node.label)
      ),
    }))
    .sort((left, right) => left.glossaryName.localeCompare(right.glossaryName));
}
