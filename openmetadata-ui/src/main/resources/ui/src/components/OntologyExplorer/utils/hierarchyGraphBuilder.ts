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

import type {
  BuildHierarchyGraphsParams,
  HierarchyComboInfo,
  HierarchyEdge,
  HierarchyGraphResult,
  HierarchyNode,
  OntologyNode,
} from '../OntologyExplorer.interface';

const HIERARCHICAL_RELATION_TYPES = new Set([
  'broader',
  'narrower',
  'partOf',
  'hasPart',
]);

function isParentSide(relationType: string): boolean {
  return relationType === 'broader' || relationType === 'hasPart';
}

function normalizeParentChild(
  from: string,
  to: string,
  relationType: string
): { parent: string; child: string } {
  if (isParentSide(relationType)) {
    return { parent: from, child: to };
  }

  return { parent: to, child: from };
}

function isHierarchicalCategory(category: unknown): boolean {
  return (
    typeof category === 'string' && category.toLowerCase() === 'hierarchical'
  );
}

function getHierarchicalRelationTypes(
  relationSettings: BuildHierarchyGraphsParams['relationSettings']
): Set<string> {
  if (relationSettings?.relationTypes?.length) {
    const set = new Set<string>();
    relationSettings.relationTypes.forEach((r) => {
      if (isHierarchicalCategory(r.category)) {
        set.add(r.name);
      }
    });
    if (set.size > 0) {
      return set;
    }
  }

  return new Set(HIERARCHICAL_RELATION_TYPES);
}

function scopeId(glossaryId: string, termId: string): string {
  return `${glossaryId}::${termId}`;
}

export function buildHierarchyGraphs({
  terms,
  relations,
  relationSettings,
  relationColors,
  glossaryNames,
}: BuildHierarchyGraphsParams): HierarchyGraphResult {
  const hierarchicalTypes = getHierarchicalRelationTypes(relationSettings);
  const hierarchicalEdges = relations.filter((e) =>
    hierarchicalTypes.has(e.relationType)
  );

  const termsWithHierarchicalRelation = new Set<string>();
  hierarchicalEdges.forEach((e) => {
    termsWithHierarchicalRelation.add(e.from);
    termsWithHierarchicalRelation.add(e.to);
  });

  const termById = new Map<string, OntologyNode>();
  terms.forEach((t) => termById.set(t.id, t));

  const parentToChildren = new Map<string, Set<string>>();
  const childToParents = new Map<string, Set<string>>();
  hierarchicalEdges.forEach((edge) => {
    const { parent, child } = normalizeParentChild(
      edge.from,
      edge.to,
      edge.relationType
    );
    if (!termById.has(parent) || !termById.has(child)) {
      return;
    }
    if (!parentToChildren.has(parent)) {
      parentToChildren.set(parent, new Set());
    }
    parentToChildren.get(parent)!.add(child);
    if (!childToParents.has(child)) {
      childToParents.set(child, new Set());
    }
    childToParents.get(child)!.add(parent);
  });

  const glossariesWithTerms = new Map<string, Set<string>>();
  terms.forEach((t) => {
    if (t.glossaryId) {
      let set = glossariesWithTerms.get(t.glossaryId);
      if (!set) {
        set = new Set();
        glossariesWithTerms.set(t.glossaryId, set);
      }
      set.add(t.id);
    }
  });

  const nodes: HierarchyNode[] = [];
  const edges: HierarchyEdge[] = [];
  const combos: HierarchyComboInfo[] = [];
  const edgeKeys = new Set<string>();

  function collectReachable(seedTermIds: Set<string>): Set<string> {
    const reachable = new Set<string>(seedTermIds);
    let frontier = new Set(seedTermIds);
    while (frontier.size > 0) {
      const next = new Set<string>();
      frontier.forEach((termId) => {
        parentToChildren.get(termId)?.forEach((c) => {
          if (!reachable.has(c)) {
            reachable.add(c);
            next.add(c);
          }
        });
        childToParents.get(termId)?.forEach((p) => {
          if (!reachable.has(p)) {
            reachable.add(p);
            next.add(p);
          }
        });
      });
      frontier = next;
    }

    return reachable;
  }

  glossariesWithTerms.forEach((seedTermIds, glossaryId) => {
    const reachable = collectReachable(seedTermIds);
    if (reachable.size === 0) {
      return;
    }

    const nodeIdsInCombo = new Set<string>();
    const comboNodes: HierarchyNode[] = [];
    reachable.forEach((termId) => {
      if (!termsWithHierarchicalRelation.has(termId)) {
        return;
      }
      const term = termById.get(termId);
      if (!term) {
        return;
      }
      const scopedId = scopeId(glossaryId, termId);
      nodeIdsInCombo.add(scopedId);
      const originalGlossary =
        term.glossaryId !== glossaryId ? term.glossaryId : undefined;
      const glossaryName = originalGlossary
        ? glossaryNames[originalGlossary] ?? originalGlossary
        : undefined;
      comboNodes.push({
        ...term,
        id: scopedId,
        termId,
        glossaryId,
        originalGlossary,
        glossaryName,
        originalNode: term,
      });
    });

    if (comboNodes.length === 0) {
      return;
    }

    const keptEdges: Array<{
      from: string;
      to: string;
      relationType: string;
      color?: string;
    }> = [];
    hierarchicalEdges.forEach((edge) => {
      const { parent, child } = normalizeParentChild(
        edge.from,
        edge.to,
        edge.relationType
      );
      const sourceId = scopeId(glossaryId, parent);
      const targetId = scopeId(glossaryId, child);
      if (!nodeIdsInCombo.has(sourceId) || !nodeIdsInCombo.has(targetId)) {
        return;
      }
      const parentTerm = termById.get(parent);
      const childTerm = termById.get(child);
      const parentIsNative = parentTerm?.glossaryId === glossaryId;
      const childIsNative = childTerm?.glossaryId === glossaryId;
      if (!parentIsNative && !childIsNative) {
        return;
      }
      const key = `${sourceId}-${targetId}-${edge.relationType}`;
      if (edgeKeys.has(key)) {
        return;
      }
      edgeKeys.add(key);
      keptEdges.push({
        from: sourceId,
        to: targetId,
        relationType: edge.relationType,
        color: relationColors[edge.relationType],
      });
    });

    const visibleNodeIds = new Set<string>();
    keptEdges.forEach((e) => {
      visibleNodeIds.add(e.from);
      visibleNodeIds.add(e.to);
    });
    comboNodes.forEach((n) => {
      const term = termById.get(n.termId);
      if (term?.glossaryId === glossaryId) {
        visibleNodeIds.add(n.id);
      }
    });
    const nodesToShow = comboNodes.filter((n) => visibleNodeIds.has(n.id));
    if (nodesToShow.length === 0) {
      return;
    }

    const comboId = `hierarchy-combo-${glossaryId}`;
    const comboLabel = glossaryNames[glossaryId] ?? glossaryId;
    combos.push({ id: comboId, label: comboLabel, glossaryId });
    nodesToShow.forEach((n) => nodes.push(n));
    keptEdges.forEach((e) =>
      edges.push({
        from: e.from,
        to: e.to,
        relationType: e.relationType,
        color: e.color,
      })
    );
  });

  return { nodes, edges, combos };
}
