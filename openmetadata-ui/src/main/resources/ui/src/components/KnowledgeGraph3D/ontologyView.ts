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

/**
 * "Ontology applied" view. The glossary is the blueprint (terms + their typed
 * relationships); the knowledge graph is the implementation (physical assets).
 * This projects the blueprint onto the implementation: it keeps only data
 * assets that carry a glossary term and connects them with asset↔asset edges
 * *derived* from their terms' relationships — not the raw concept nodes.
 *
 * Everything is derived from the already-adapted graph (the RDF payload already
 * carries concept nodes, term↔term edges and asset→term "Mapped to" edges), so
 * no extra glossary-API fetch is needed. Ported from the reference
 * `ontologyView()`.
 */

import { TFunction } from 'i18next';
import { idOf } from './KnowledgeGraph3D.utils';
import {
  DerivedRelation,
  Graph3DData,
  GraphLink3D,
  GraphNode3D,
  Level,
  NodeType,
} from './types';

/**
 * Data-asset node types that can carry a glossary term and so participate in
 * ontology-derived edges. Structural (database/schema/service) and non-asset
 * (concept/domain/product/tag/user/team/column) nodes are excluded.
 */
const ONTOLOGY_ASSET_TYPES = new Set<NodeType>([
  'table',
  'dashboard',
  'topic',
  'mlmodel',
  'container',
  'searchIndex',
  'pipeline',
  'storedProcedure',
  'api',
  'metric',
  'chart',
]);

const MAPPED_TO = 'Mapped to';
const PARENT_OF = 'Parent of';
const CHILD_OF = 'Child of';
const BROADER_NARROWER = 'Broader / narrower';
const RELATED_TO = 'Related to';
const SYNONYM = 'Synonym';

interface Lookups {
  /** assetId → the concept (term) ids mapped onto it. */
  mapped: Map<string, Set<string>>;
  /** termId → its parent term ids (broader concepts). */
  parentOf: Map<string, Set<string>>;
  /** termId → related/synonym term ids (symmetric). */
  related: Map<string, Set<string>>;
}

interface Candidate {
  rank: number;
  relation: DerivedRelation;
  path: string[];
}

/**
 * Plain-English form of a derived relationship. Used only as the link's stable
 * identity/fallback `label`; the user-facing string is built with i18n via
 * {@link formatDerivedRelation}.
 */
const describeRelation = (relation: DerivedRelation): string => {
  const { kind, term, from, to } = relation;
  let result: string;
  switch (kind) {
    case 'same':
      result = `Both mapped to ${term}`;

      break;
    case 'siblings':
      result = `Siblings · both under ${term}`;

      break;
    case 'subtype':
      result = `${from} is a ${to}`;

      break;
    case 'related':
    default:
      result = `Related · ${from} ↔ ${to}`;

      break;
  }

  return result;
};

/** Builds the translated, display-ready label for a derived edge. */
export const formatDerivedRelation = (
  t: TFunction,
  relation: DerivedRelation
): string => {
  const { kind, term, from, to } = relation;
  let result: string;
  switch (kind) {
    case 'same':
      result = t('message.ontology-relation-same', { term });

      break;
    case 'siblings':
      result = t('message.ontology-relation-siblings', { term });

      break;
    case 'subtype':
      result = t('message.ontology-relation-subtype', { from, to });

      break;
    case 'related':
    default:
      result = t('message.ontology-relation-related', { from, to });

      break;
  }

  return result;
};

const addTo = (
  map: Map<string, Set<string>>,
  key: string,
  value: string
): void => {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
};

const buildLookups = (
  graph: Graph3DData,
  byId: Map<string, GraphNode3D>
): Lookups => {
  const mapped = new Map<string, Set<string>>();
  const parentOf = new Map<string, Set<string>>();
  const related = new Map<string, Set<string>>();
  graph.links.forEach((link) => {
    if (link.kind !== 'ontology') {
      return;
    }
    const source = idOf(link.source);
    const target = idOf(link.target);
    const sourceIsConcept = byId.get(source)?.type === 'concept';
    const targetIsConcept = byId.get(target)?.type === 'concept';
    if (link.label === MAPPED_TO) {
      if (targetIsConcept && !sourceIsConcept) {
        addTo(mapped, source, target);
      } else if (sourceIsConcept && !targetIsConcept) {
        addTo(mapped, target, source);
      }
    } else if (link.label === PARENT_OF || link.label === BROADER_NARROWER) {
      addTo(parentOf, target, source);
    } else if (link.label === CHILD_OF) {
      addTo(parentOf, source, target);
    } else if (link.label === RELATED_TO || link.label === SYNONYM) {
      addTo(related, source, target);
      addTo(related, target, source);
    }
  });

  return { mapped, parentOf, related };
};

/**
 * Picks the single strongest glossary relationship between two assets (lower
 * rank wins): 1 same term, 2 siblings (shared parent), 3 broader/narrower,
 * 4 related/synonym. Returns null when their terms don't connect them.
 */
const strongestRelation = (
  a: GraphNode3D,
  b: GraphNode3D,
  lookups: Lookups,
  nameOf: (id: string) => string
): Candidate | null => {
  let best: Candidate | null = null;
  const consider = (candidate: Candidate): void => {
    if (!best || candidate.rank < best.rank) {
      best = candidate;
    }
  };
  const aTerms = lookups.mapped.get(a.id) ?? new Set<string>();
  const bTerms = lookups.mapped.get(b.id) ?? new Set<string>();
  aTerms.forEach((x) => {
    bTerms.forEach((y) => {
      if (x === y) {
        const term = nameOf(x);
        consider({
          rank: 1,
          relation: { kind: 'same', term },
          path: [a.name, term, b.name],
        });

        return;
      }
      const parentsOfX = lookups.parentOf.get(x);
      const parentsOfY = lookups.parentOf.get(y);
      parentsOfX?.forEach((parent) => {
        if (parentsOfY?.has(parent)) {
          const term = nameOf(parent);
          consider({
            rank: 2,
            relation: { kind: 'siblings', term },
            path: [a.name, nameOf(x), term, nameOf(y), b.name],
          });
        }
      });
      if (parentsOfX?.has(y)) {
        consider({
          rank: 3,
          relation: { kind: 'subtype', from: nameOf(x), to: nameOf(y) },
          path: [a.name, nameOf(x), nameOf(y), b.name],
        });
      }
      if (parentsOfY?.has(x)) {
        consider({
          rank: 3,
          relation: { kind: 'subtype', from: nameOf(y), to: nameOf(x) },
          path: [b.name, nameOf(y), nameOf(x), a.name],
        });
      }
      if (lookups.related.get(x)?.has(y)) {
        consider({
          rank: 4,
          relation: { kind: 'related', from: nameOf(x), to: nameOf(y) },
          path: [a.name, nameOf(x), nameOf(y), b.name],
        });
      }
    });
  });

  return best;
};

const withTermOverlay = (
  asset: GraphNode3D,
  lookups: Lookups,
  byId: Map<string, GraphNode3D>,
  nameOf: (id: string) => string
): GraphNode3D => {
  const terms = [...(lookups.mapped.get(asset.id) ?? [])]
    .filter((concept) => byId.has(concept))
    .map(nameOf);

  return { ...asset, term: terms[0], termCount: terms.length };
};

export const ontologyView = (graph: Graph3DData, level: Level): Graph3DData => {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const nameOf = (id: string): string => byId.get(id)?.name ?? id;
  const lookups = buildLookups(graph, byId);
  const assets = graph.nodes.filter(
    (node) =>
      ONTOLOGY_ASSET_TYPES.has(node.type) &&
      node.levels.includes(level) &&
      (lookups.mapped.get(node.id)?.size ?? 0) > 0
  );

  const links: GraphLink3D[] = [];
  for (let i = 0; i < assets.length; i += 1) {
    for (let j = i + 1; j < assets.length; j += 1) {
      const best = strongestRelation(assets[i], assets[j], lookups, nameOf);
      if (best) {
        links.push({
          source: assets[i].id,
          target: assets[j].id,
          label: describeRelation(best.relation),
          kind: 'ontology',
          derived: true,
          relation: best.relation,
          path: best.path,
          levels: [level],
        });
      }
    }
  }

  const connected = new Set<string>();
  links.forEach((link) => {
    connected.add(idOf(link.source));
    connected.add(idOf(link.target));
  });
  const nodes = assets
    .filter((asset) => connected.has(asset.id))
    .map((asset) => withTermOverlay(asset, lookups, byId, nameOf));

  return { nodes, links };
};
