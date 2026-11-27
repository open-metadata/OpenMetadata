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

import { getNameFromFQN } from '../../../utils/FqnUtils';
import {
  GraphFilters,
  OntologyGraphData,
  OntologyNode,
} from '../OntologyExplorer.interface';
import { isTermNode } from './graphBuilders';

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
