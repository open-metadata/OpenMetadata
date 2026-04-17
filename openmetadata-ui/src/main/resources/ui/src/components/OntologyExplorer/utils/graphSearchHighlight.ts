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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 */
import { includes, toLower } from 'lodash';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTermRelationType } from '../../../rest/settingConfigAPI';
import { OntologyEdge, OntologyNode } from '../OntologyExplorer.interface';

export interface GraphSearchHighlightInput {
  active: boolean;
  highlightedNodeIds: readonly string[];
  highlightedEdgeKeys: readonly string[];
  highlightedGlossaryIds: readonly string[];
}

function textMatches(query: string, value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return includes(toLower(value), query);
}

export function ontologyEdgeKey(edge: OntologyEdge): string {
  return `${edge.from}::${edge.to}::${edge.relationType}`;
}

/**
 * Single search box: highlights nodes, glossaries, and relation types whose
 * text matches (union), plus incident edges and glossary group combos.
 */
export function computeGraphSearchHighlight(
  nodes: OntologyNode[],
  edges: OntologyEdge[],
  rawQuery: string,
  glossaries: Glossary[],
  relationTypes: GlossaryTermRelationType[]
): GraphSearchHighlightInput | null {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return null;
  }

  const entityMatchedNodeIds = new Set<string>();
  const highlightedGlossaryIds = new Set<string>();

  nodes.forEach((n) => {
    if (
      textMatches(query, n.label) ||
      textMatches(query, n.fullyQualifiedName) ||
      textMatches(query, n.description)
    ) {
      entityMatchedNodeIds.add(n.id);
    }
  });

  glossaries.forEach((g) => {
    if (
      g.id &&
      (textMatches(query, g.name) ||
        textMatches(query, g.displayName) ||
        textMatches(query, g.fullyQualifiedName) ||
        textMatches(query, g.description))
    ) {
      highlightedGlossaryIds.add(g.id);
    }
  });
  nodes.forEach((n) => {
    if (n.type === 'glossary' && n.id && highlightedGlossaryIds.has(n.id)) {
      entityMatchedNodeIds.add(n.id);
    }
    if (n.glossaryId && highlightedGlossaryIds.has(n.glossaryId)) {
      entityMatchedNodeIds.add(n.id);
    }
  });

  const matchedRelationNames = new Set<string>();
  relationTypes.forEach((rt) => {
    if (
      textMatches(query, rt.name) ||
      textMatches(query, rt.displayName) ||
      textMatches(query, rt.description)
    ) {
      matchedRelationNames.add(rt.name);
    }
  });

  const relationMatchedEdgeKeys = new Set<string>();
  edges.forEach((e) => {
    if (
      matchedRelationNames.has(e.relationType) ||
      textMatches(query, e.relationType)
    ) {
      relationMatchedEdgeKeys.add(ontologyEdgeKey(e));
    }
  });

  const entityIncidentEdgeKeys = new Set<string>();
  edges.forEach((e) => {
    if (entityMatchedNodeIds.has(e.from) || entityMatchedNodeIds.has(e.to)) {
      entityIncidentEdgeKeys.add(ontologyEdgeKey(e));
    }
  });

  const highlightedEdgeKeys = new Set<string>([
    ...relationMatchedEdgeKeys,
    ...entityIncidentEdgeKeys,
  ]);

  const highlightedNodeIds = new Set<string>(entityMatchedNodeIds);
  edges.forEach((e) => {
    const key = ontologyEdgeKey(e);
    if (highlightedEdgeKeys.has(key)) {
      highlightedNodeIds.add(e.from);
      highlightedNodeIds.add(e.to);
    }
  });

  return {
    active: true,
    highlightedNodeIds: [...highlightedNodeIds].sort((a, b) =>
      a.localeCompare(b)
    ),
    highlightedEdgeKeys: [...highlightedEdgeKeys].sort((a, b) =>
      a.localeCompare(b)
    ),
    highlightedGlossaryIds: [...highlightedGlossaryIds].sort((a, b) =>
      a.localeCompare(b)
    ),
  };
}
