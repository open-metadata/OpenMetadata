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
 * Normalized graph model consumed by the 3D Knowledge Graph renderer. The
 * adapter (rdfGraphAdapter) maps the RDF `GraphData` response from
 * `/rdf/graph/explore` into this shape, deriving the link `kind`, per-node
 * `levels`, and table `mapped` (coverage) signals that the RDF payload does
 * not carry explicitly.
 */

export type Level = 'asset' | 'product' | 'domain';

export type Lens = 'all' | 'technical' | 'ontology';

export type LinkKind = 'technical' | 'ontology';

export type NodeType =
  | 'domain'
  | 'product'
  | 'table'
  | 'column'
  | 'database'
  | 'schema'
  | 'service'
  | 'dashboard'
  | 'pipeline'
  | 'user'
  | 'team'
  | 'concept'
  | 'tag'
  | 'query'
  | 'topic'
  | 'container'
  | 'mlmodel'
  | 'searchIndex'
  | 'storedProcedure'
  | 'testCase'
  | 'testSuite'
  | 'dataContract'
  | 'api'
  | 'metric'
  | 'chart'
  | 'file'
  | 'directory';

export interface GraphNode3D {
  id: string;
  name: string;
  type: NodeType;
  levels: Level[];
  fullyQualifiedName?: string;
  description?: string;
  /** Tables only: true when at least one ontology (glossary) mapping exists. */
  mapped?: boolean;
  /** Ontology mode: the primary glossary term laid over this asset node. */
  term?: string;
  /** Ontology mode: how many glossary terms this asset carries (drives "+N"). */
  termCount?: number;
}

/** The kind of glossary relationship a derived ontology edge was inferred from. */
export type DerivedRelationKind = 'same' | 'siblings' | 'subtype' | 'related';

/**
 * Structured descriptor of a derived edge's relationship, carrying the glossary
 * term names so the display string can be built with i18n (the term names are
 * data; only the connective words are translated).
 */
export interface DerivedRelation {
  kind: DerivedRelationKind;
  /** Shared term ('same') or shared parent term ('siblings'). */
  term?: string;
  /** The A-side term for 'subtype'/'related'. */
  from?: string;
  /** The B-side term for 'subtype'/'related'. */
  to?: string;
}

export interface GraphLink3D {
  source: string;
  target: string;
  label: string;
  kind: LinkKind;
  levels: Level[];
  /**
   * Ontology mode: true when this asset↔asset edge is inferred by overlaying
   * the glossary terms, not a direct technical/RDF relation.
   */
  derived?: boolean;
  /** Ontology mode: structured relationship, formatted for display with i18n. */
  relation?: DerivedRelation;
  /**
   * Ontology mode: the derivation chain as display names, endpoints first and
   * last (assets) with the glossary terms in between — e.g.
   * `[savings_account, Savings Account, Accounts, Checking Account, checking_account]`.
   */
  path?: string[];
}

export interface Graph3DData {
  nodes: GraphNode3D[];
  links: GraphLink3D[];
  /**
   * Ontology mode: true when the derivation hit its asset/edge caps, so the
   * shown graph is a bounded subset. Surfaced in the caption like the
   * server-side `truncated` signal.
   */
  truncated?: boolean;
}

/** A relation row used by the detail panel. */
export interface RelationRow {
  label: string;
  other: GraphNode3D;
  direction: 'in' | 'out';
  kind: LinkKind;
}

/** A "related through a shared concept" row used by the detail panel. */
export interface SharedConceptRow {
  asset: GraphNode3D;
  via: string;
  path: string;
}

export interface NodeRelations {
  technical: RelationRow[];
  hierarchy: RelationRow[];
  members: RelationRow[];
  mapped: RelationRow[];
  shared: SharedConceptRow[];
  node?: GraphNode3D;
}
