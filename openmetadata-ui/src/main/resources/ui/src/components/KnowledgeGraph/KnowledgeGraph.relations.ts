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

import { resolveCssColor } from '../../utils/common/cssColor.utils';

/**
 * Every RDF predicate the graph can return is folded into one of these six
 * families. The family — not the raw predicate — drives edge colour, dash
 * pattern and the legend, so a graph with thirty distinct predicates still
 * reads as six visually distinct kinds of relationship.
 */
export type RelationCategory =
  | 'lineage'
  | 'structure'
  | 'ownership'
  | 'governance'
  | 'ontology'
  | 'quality';

export const RELATION_CATEGORIES: RelationCategory[] = [
  'lineage',
  'structure',
  'ontology',
  'governance',
  'ownership',
  'quality',
];

/**
 * Visual identity of a relation family. `color`/`labelBg` are CSS custom
 * properties resolved against the live theme at draw time (see
 * {@link getRelationStyle}); the hex fallbacks apply only when the token
 * cannot be read, e.g. in a jsdom test with no stylesheet.
 */
interface RelationCategoryStyle {
  color: string;
  colorFallback: string;
  labelBg: string;
  labelBgFallback: string;
  /** Canvas dash pattern; an empty array draws a solid line. */
  lineDash: number[];
  labelKey: string;
}

/**
 * Dash patterns double as a redundant, colour-blind-safe channel: lineage is
 * solid, structure long-dashed, ontology dotted, and so on, so the families
 * stay separable in greyscale and for dichromatic vision.
 */
const RELATION_CATEGORY_STYLES: Record<
  RelationCategory,
  RelationCategoryStyle
> = {
  lineage: {
    color: 'var(--om-color-blue-dark-600)',
    colorFallback: '#155eef',
    labelBg: 'var(--om-color-blue-dark-50)',
    labelBgFallback: '#eff4ff',
    lineDash: [],
    labelKey: 'label.lineage',
  },
  structure: {
    color: 'var(--om-color-gray-blue-500)',
    colorFallback: '#4e5ba6',
    labelBg: 'var(--om-color-gray-blue-50)',
    labelBgFallback: '#f8f9fc',
    lineDash: [10, 5],
    labelKey: 'label.structure',
  },
  ontology: {
    color: 'var(--om-color-purple-600)',
    colorFallback: '#6938ef',
    labelBg: 'var(--om-color-purple-50)',
    labelBgFallback: '#f4f3ff',
    lineDash: [2, 4],
    labelKey: 'label.ontology',
  },
  governance: {
    color: 'var(--om-color-teal-600)',
    colorFallback: '#0e9384',
    labelBg: 'var(--om-color-teal-50)',
    labelBgFallback: '#f0fdf9',
    lineDash: [8, 3, 2, 3],
    labelKey: 'label.governance',
  },
  ownership: {
    color: 'var(--om-color-orange-dark-600)',
    colorFallback: '#e62e05',
    labelBg: 'var(--om-color-orange-dark-50)',
    labelBgFallback: '#fff4ed',
    lineDash: [4, 4],
    labelKey: 'label.ownership',
  },
  quality: {
    color: 'var(--om-color-pink-600)',
    colorFallback: '#dd2590',
    labelBg: 'var(--om-color-pink-50)',
    labelBgFallback: '#fdf2fa',
    lineDash: [6, 2, 1, 2],
    labelKey: 'label.data-quality',
  },
};

/** Resolved-at-draw-time counterpart of {@link RelationCategoryStyle}. */
export interface ResolvedRelationStyle {
  color: string;
  labelBg: string;
  lineDash: number[];
  labelKey: string;
}

export const getRelationStyle = (
  category: RelationCategory
): ResolvedRelationStyle => {
  const style = RELATION_CATEGORY_STYLES[category];

  return {
    color: resolveCssColor(style.color, style.colorFallback),
    labelBg: resolveCssColor(style.labelBg, style.labelBgFallback),
    lineDash: style.lineDash,
    labelKey: style.labelKey,
  };
};

/**
 * Strips namespace prefixes and separators so `om:hasColumn`, `HAS_COLUMN` and
 * `has column` all collapse to the same lookup key.
 */
export const normalizeRelationKey = (label: string): string =>
  label
    .replace(/^.*[#/:]/, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '');

/**
 * Predicate → family. Keys are normalized by {@link normalizeRelationKey}.
 * Kept in sync with the predicates emitted by `RdfRepository`'s graph explore
 * query; anything absent falls through to {@link classifyRelation}'s
 * type-based heuristics.
 */
const CATEGORY_BY_PREDICATE: Record<string, RelationCategory> = {
  // lineage — data actually flows along these
  haslineage: 'lineage',
  lineage: 'lineage',
  upstream: 'lineage',
  downstream: 'lineage',
  upstreamof: 'lineage',
  downstreamof: 'lineage',
  derivedfrom: 'lineage',
  dependson: 'lineage',
  wasderivedfrom: 'lineage',
  wasgeneratedby: 'lineage',
  used: 'lineage',

  // structure — containment / composition of the physical catalogue
  hascolumn: 'structure',
  hasfield: 'structure',
  belongsto: 'structure',
  belongstoschema: 'structure',
  belongstodatabase: 'structure',
  belongstoservice: 'structure',
  hasdatabase: 'structure',
  hasschema: 'structure',
  hastable: 'structure',
  haschart: 'structure',

  // ownership — people and teams
  ownedby: 'ownership',
  hasowner: 'ownership',
  owner: 'ownership',
  ownedbyteam: 'ownership',
  createdby: 'ownership',
  updatedby: 'ownership',
  wasattributedto: 'ownership',
  steward: 'ownership',
  hassteward: 'ownership',
  memberof: 'ownership',
  hasmember: 'ownership',
  expert: 'ownership',
  reviewer: 'ownership',

  // governance — domains, products, tags, contracts
  partofdomain: 'governance',
  hasdomain: 'governance',
  domain: 'governance',
  domains: 'governance',
  inputport: 'governance',
  outputport: 'governance',
  hasdataproduct: 'governance',
  dataproduct: 'governance',
  hastag: 'governance',
  taggedwith: 'governance',
  hasclassification: 'governance',
  hasdatacontract: 'governance',
  tier: 'governance',
  hastier: 'governance',

  // ontology — business meaning
  mappedto: 'ontology',
  hasglossaryterm: 'ontology',
  glossaryterm: 'ontology',
  parentof: 'ontology',
  childof: 'ontology',
  relatedto: 'ontology',
  related: 'ontology',
  isrelatedto: 'ontology',
  isa: 'ontology',
  isalso: 'ontology',
  synonym: 'ontology',
  synonymof: 'ontology',
  hassynonym: 'ontology',
  broader: 'ontology',
  narrower: 'ontology',
  broadernarrower: 'ontology',
  seealso: 'ontology',
  mentionedin: 'ontology',
  mentions: 'ontology',

  // quality — tests and their verdicts
  hastestcase: 'quality',
  testcase: 'quality',
  hastestsuite: 'quality',
  testsuite: 'quality',
  validates: 'quality',
  hasincident: 'quality',
};

/** Entity types that make an otherwise-unknown predicate a business relation. */
const ONTOLOGY_NODE_TYPES = new Set([
  'glossaryterm',
  'glossary',
  'concept',
  'term',
]);

/** Entity types that make an otherwise-unknown predicate a people relation. */
const PEOPLE_NODE_TYPES = new Set(['user', 'team']);

const GOVERNANCE_NODE_TYPES = new Set([
  'domain',
  'dataproduct',
  'tag',
  'classification',
  'datacontract',
]);

const QUALITY_NODE_TYPES = new Set(['testcase', 'testsuite', 'testdefinition']);

const normalizeNodeType = (type: string): string =>
  type.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

/**
 * Falls back to the endpoint types when the predicate itself is unknown: a
 * custom glossary relation such as `Regulates` still reads as an ontology
 * edge because one of its endpoints is a glossary term.
 */
const categoryFromEndpoints = (
  sourceType: string,
  targetType: string
): RelationCategory => {
  const source = normalizeNodeType(sourceType);
  const target = normalizeNodeType(targetType);
  let category: RelationCategory = 'structure';

  if (PEOPLE_NODE_TYPES.has(source) || PEOPLE_NODE_TYPES.has(target)) {
    category = 'ownership';
  } else if (
    ONTOLOGY_NODE_TYPES.has(source) ||
    ONTOLOGY_NODE_TYPES.has(target)
  ) {
    category = 'ontology';
  } else if (QUALITY_NODE_TYPES.has(source) || QUALITY_NODE_TYPES.has(target)) {
    category = 'quality';
  } else if (
    GOVERNANCE_NODE_TYPES.has(source) ||
    GOVERNANCE_NODE_TYPES.has(target)
  ) {
    category = 'governance';
  }

  return category;
};

/**
 * Predicates whose meaning comes from what they connect rather than from the
 * verb. `Contains` is structure between a schema and a table but quality
 * between a table and its test suite, and `Has` is governance from a domain;
 * mapping them to a fixed family would mislabel every other use, so the
 * endpoint types decide instead.
 */
const GENERIC_PREDICATES = new Set([
  'contains',
  'has',
  'haspart',
  'partof',
  'includes',
  'relates',
]);

export const classifyRelation = (
  rawLabel: string,
  sourceType = '',
  targetType = ''
): RelationCategory => {
  const key = normalizeRelationKey(rawLabel);

  return GENERIC_PREDICATES.has(key)
    ? categoryFromEndpoints(sourceType, targetType)
    : CATEGORY_BY_PREDICATE[key] ??
        categoryFromEndpoints(sourceType, targetType);
};

/**
 * A merged edge carries every predicate between the same two nodes but can only
 * be drawn in one colour. When the members disagree — a glossary term arrives as
 * both `Has Glossary Term` and `Has Tag` — the more specific family wins, so the
 * edge advertises the strongest claim it represents rather than whichever
 * predicate the server happened to return first.
 */
const CATEGORY_PRECEDENCE: RelationCategory[] = [
  'lineage',
  'ontology',
  'quality',
  'governance',
  'ownership',
  'structure',
];

export const classifyMergedRelation = (
  rawLabels: string[],
  sourceType = '',
  targetType = ''
): RelationCategory => {
  const found = new Set(
    rawLabels.map((label) => classifyRelation(label, sourceType, targetType))
  );

  return (
    CATEGORY_PRECEDENCE.find((category) => found.has(category)) ?? 'structure'
  );
};

/**
 * `hasColumn` / `HAS_COLUMN` / `om:has_column` → `Has column`. Used only for
 * predicates with no canonical translation, so the raw RDF term still reads as
 * a phrase rather than as an identifier.
 */
export const humanizeRelationLabel = (rawLabel: string): string => {
  const local = rawLabel.replace(/^.*[#/:]/, '');
  const spaced = local
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();

  return spaced.length === 0
    ? rawLabel
    : spaced.charAt(0).toUpperCase() + spaced.slice(1);
};
