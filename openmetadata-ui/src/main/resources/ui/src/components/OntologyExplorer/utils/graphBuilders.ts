/*
 *  Copyright 2024 Collate.
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

import type { TFunction } from 'i18next';
import { EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Metric } from '../../../generated/entity/data/metric';
import { EntityReference } from '../../../generated/entity/type';
import { TagSource } from '../../../generated/type/tagLabel';
import { TermRelation } from '../../../generated/type/termRelation';
import { GraphData } from '../../../rest/rdfAPI';
import {
  OntologyEdge,
  OntologyExplorerProps,
  OntologyGraphData,
  OntologyNode,
} from '../OntologyExplorer.interface';

export const GLOSSARY_COLORS = [
  '#3062d4',
  '#7c3aed',
  '#059669',
  '#dc2626',
  '#ea580c',
  '#0891b2',
  '#4f46e5',
  '#ca8a04',
  '#be185d',
  '#0d9488',
];

export const METRIC_NODE_TYPE = 'metric';
export const METRIC_RELATION_TYPE = 'metricFor';
export const ASSET_NODE_TYPE = 'dataAsset';
export const ASSET_RELATION_TYPE = 'hasGlossaryTerm';

export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

export function isTermNode(node: OntologyNode): boolean {
  return node.type === 'glossaryTerm' || node.type === 'glossaryTermIsolated';
}

export function isDataAssetLikeNode(node: OntologyNode): boolean {
  return node.type === ASSET_NODE_TYPE || node.type === METRIC_NODE_TYPE;
}

export function getScopedTermNodes(
  nodes: OntologyNode[],
  glossaryIds: string[],
  scope: OntologyExplorerProps['scope'],
  entityId?: string
): OntologyNode[] {
  let termNodes = nodes.filter(isTermNode);

  if (glossaryIds.length > 0) {
    termNodes = termNodes.filter(
      (node) => node.glossaryId && glossaryIds.includes(node.glossaryId)
    );
  }

  if (scope === 'term' && entityId) {
    termNodes = termNodes.filter((node) => node.id === entityId);
  }

  return termNodes;
}

export function searchHitSourceToEntityRef(
  source: unknown
): EntityReference | null {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const s = source as Record<string, unknown>;
  const id = s.id;
  const typeField = s.entityType ?? s.type;
  const fqn = s.fullyQualifiedName;
  if (
    typeof id !== 'string' ||
    typeof typeField !== 'string' ||
    typeof fqn !== 'string'
  ) {
    return null;
  }

  return {
    id,
    type: typeField,
    name: typeof s.name === 'string' ? s.name : undefined,
    displayName: typeof s.displayName === 'string' ? s.displayName : undefined,
    fullyQualifiedName: fqn,
    description: typeof s.description === 'string' ? s.description : undefined,
  };
}

export function convertRdfGraphToOntologyGraph(
  rdfData: GraphData,
  glossaryList: Glossary[]
): OntologyGraphData {
  const glossaryNameToId = new Map<string, string>();
  glossaryList.forEach((g) => {
    glossaryNameToId.set(g.name.toLowerCase(), g.id);
    if (g.fullyQualifiedName) {
      glossaryNameToId.set(g.fullyQualifiedName.toLowerCase(), g.id);
    }
  });

  const nodes: OntologyNode[] = rdfData.nodes.map((node) => {
    let glossaryId: string | undefined;
    if (node.group) {
      glossaryId = glossaryNameToId.get(node.group.toLowerCase());
    }
    if (!glossaryId && node.fullyQualifiedName) {
      const glossaryName = node.fullyQualifiedName.split('.')[0];
      glossaryId = glossaryNameToId.get(glossaryName.toLowerCase());
    }

    let nodeLabel = node.label;
    const isUuidLabel =
      nodeLabel &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        nodeLabel
      );

    if (!nodeLabel || isUuidLabel) {
      if (node.fullyQualifiedName) {
        const parts = node.fullyQualifiedName.split('.');
        nodeLabel = parts[parts.length - 1];
      } else if (node.title) {
        nodeLabel = node.title;
      } else {
        nodeLabel = node.id;
      }
    }

    return {
      id: node.id,
      label: nodeLabel,
      type: node.type || 'glossaryTerm',
      fullyQualifiedName: node.fullyQualifiedName,
      description: node.description,
      glossaryId,
      group: node.group,
    };
  });

  const edgeMap = new Map<string, OntologyEdge>();
  rdfData.edges.forEach((edge) => {
    const relationType = edge.relationType || 'relatedTo';
    const nodePairKey = [edge.from, edge.to].sort().join('-');
    const existingEdge = edgeMap.get(nodePairKey);
    if (
      !existingEdge ||
      (existingEdge.relationType === 'relatedTo' &&
        relationType !== 'relatedTo')
    ) {
      edgeMap.set(nodePairKey, {
        from: edge.from,
        to: edge.to,
        label: edge.label || relationType,
        relationType,
      });
    }
  });

  return { nodes, edges: Array.from(edgeMap.values()) };
}

export function buildGraphFromAllTerms(
  terms: GlossaryTerm[],
  glossaryList: Glossary[],
  t: TFunction
): OntologyGraphData {
  const nodesMap = new Map<string, OntologyNode>();
  const edges: OntologyEdge[] = [];
  const edgeSet = new Set<string>();

  terms.forEach((term) => {
    if (!term.id || !isValidUUID(term.id)) {
      return;
    }

    const hasRelations =
      (term.relatedTerms && term.relatedTerms.length > 0) ||
      (term.children && term.children.length > 0) ||
      term.parent;

    nodesMap.set(term.id, {
      id: term.id,
      label: term.displayName || term.name,
      type: hasRelations ? 'glossaryTerm' : 'glossaryTermIsolated',
      fullyQualifiedName: term.fullyQualifiedName,
      description: term.description,
      glossaryId: term.glossary?.id,
      group: glossaryList.find((g) => g.id === term.glossary?.id)?.name,
      owners: term.owners,
    });

    if (term.relatedTerms && term.relatedTerms.length > 0) {
      term.relatedTerms.forEach((relation: TermRelation) => {
        const relatedTermRef = relation.term;
        const relationType = relation.relationType || 'relatedTo';
        if (relatedTermRef?.id && isValidUUID(relatedTermRef.id)) {
          const nodePairKey = [term.id, relatedTermRef.id].sort().join('-');
          if (!edgeSet.has(nodePairKey)) {
            edgeSet.add(nodePairKey);
            edges.push({
              from: term.id,
              to: relatedTermRef.id,
              label: relationType,
              relationType,
            });
          } else if (relationType !== 'relatedTo') {
            const existingEdgeIndex = edges.findIndex(
              (e) =>
                [e.from, e.to].sort().join('-') === nodePairKey &&
                e.relationType === 'relatedTo'
            );
            if (existingEdgeIndex !== -1) {
              edges[existingEdgeIndex] = {
                from: term.id,
                to: relatedTermRef.id,
                label: relationType,
                relationType,
              };
            }
          }
        }
      });
    }

    if (term.parent?.id && isValidUUID(term.parent.id)) {
      const edgeKey = `parent-${term.parent.id}-${term.id}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push({
          from: term.parent.id,
          to: term.id,
          label: t('label.parent'),
          relationType: 'parentOf',
        });
      }
    }
  });

  const nodeIds = new Set(nodesMap.keys());
  const validEdges = edges.filter(
    (e) => nodeIds.has(e.from) && nodeIds.has(e.to)
  );

  return { nodes: Array.from(nodesMap.values()), edges: validEdges };
}

export function buildGraphFromCounts(
  counts: Record<string, number>,
  glossaries: Glossary[],
  t: TFunction
): OntologyGraphData {
  const fqnSet = new Set(Object.keys(counts));
  const nodes: OntologyNode[] = [];
  const edges: OntologyEdge[] = [];
  const edgeSet = new Set<string>();

  fqnSet.forEach((fqn) => {
    const parts = fqn.split('.');
    const label = parts[parts.length - 1];
    const glossaryFqn = parts[0];
    const glossary = glossaries.find(
      (g) => g.fullyQualifiedName === glossaryFqn || g.name === glossaryFqn
    );

    nodes.push({
      id: fqn,
      label,
      type: 'glossaryTerm',
      fullyQualifiedName: fqn,
      glossaryId: glossary?.id,
      group: glossary?.name ?? glossaryFqn,
      originalLabel: fqn,
    });

    if (parts.length > 2) {
      const parentFqn = parts.slice(0, -1).join('.');
      if (fqnSet.has(parentFqn)) {
        const edgeKey = `parent-${parentFqn}-${fqn}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            from: parentFqn,
            to: fqn,
            label: t('label.parent'),
            relationType: 'parentOf',
          });
        }
      }
    }
  });

  return { nodes, edges };
}

export function mergeMetricsIntoGraph(
  graph: OntologyGraphData | null,
  metricList: Metric[],
  t: TFunction
): OntologyGraphData | null {
  if (!graph || metricList.length === 0) {
    return graph;
  }

  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edgeKeys = new Set(
    edges.map((edge) => `${edge.from}-${edge.to}-${edge.relationType}`)
  );
  const termByFqn = new Map<string, OntologyNode>();

  nodes.forEach((node) => {
    if (node.fullyQualifiedName) {
      termByFqn.set(node.fullyQualifiedName, node);
    }
  });

  metricList.forEach((metric) => {
    const glossaryTags =
      metric.tags?.filter((tag) => tag.source === TagSource.Glossary) ?? [];

    if (glossaryTags.length === 0 || !metric.id) {
      return;
    }

    const relatedTerms = glossaryTags
      .map((tag) => termByFqn.get(tag.tagFQN))
      .filter((term): term is OntologyNode => Boolean(term));

    if (relatedTerms.length === 0) {
      return;
    }

    if (!nodeIds.has(metric.id)) {
      nodes.push({
        id: metric.id,
        label: metric.displayName || metric.name,
        originalLabel: metric.displayName || metric.name,
        type: METRIC_NODE_TYPE,
        fullyQualifiedName: metric.fullyQualifiedName,
        description: metric.description,
        group: t('label.metric-plural'),
        entityRef: {
          id: metric.id,
          name: metric.name,
          displayName: metric.displayName,
          type: EntityType.METRIC,
          fullyQualifiedName: metric.fullyQualifiedName,
          description: metric.description,
        },
      });
      nodeIds.add(metric.id);
    }

    relatedTerms.forEach((term) => {
      const edgeKey = `${metric.id}-${term.id}-${METRIC_RELATION_TYPE}`;
      if (!edgeKeys.has(edgeKey)) {
        edges.push({
          from: metric.id,
          to: term.id,
          label: 'Metric for',
          relationType: METRIC_RELATION_TYPE,
        });
        edgeKeys.add(edgeKey);
      }
    });
  });

  return { nodes, edges };
}
