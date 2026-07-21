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

export interface OntologyStudioDataGraph {
  clusters: OntologyStudioAssetCluster[];
  edges: GlossaryTermRelationGraphEdge[];
  paging: Paging;
}

export interface OntologyStudioAssetCluster {
  assetCount: number;
  assets: OntologyStudioAsset[];
  term: GlossaryTermRelationGraphNode;
}

export interface OntologyStudioAsset {
  columnCount?: number;
  entity: EntityReference;
  service?: EntityReference;
  serviceType?: string;
}

export interface EntityReference {
  deleted?: boolean;
  description?: string;
  displayName?: string;
  fullyQualifiedName?: string;
  href?: string;
  id: string;
  inherited?: boolean;
  name?: string;
  type: string;
}

export interface GlossaryTermRelationGraphNode {
  displayName?: string;
  fullyQualifiedName: string;
  id: string;
  name: string;
}

export interface GlossaryTermRelationGraphEdge {
  createdAt?: number;
  createdBy?: string;
  from: string;
  id: string;
  provenance: Provenance;
  relationshipType?: EntityReference;
  relationType: string;
  status: EntityStatus;
  to: string;
}

export enum Provenance {
  AISuggested = 'AiSuggested',
  Imported = 'Imported',
  Inferred = 'Inferred',
  Manual = 'Manual',
}

export enum EntityStatus {
  Approved = 'Approved',
  Archived = 'Archived',
  Deprecated = 'Deprecated',
  Draft = 'Draft',
  InReview = 'In Review',
  Rejected = 'Rejected',
  Unprocessed = 'Unprocessed',
}

export interface Paging {
  after?: string;
  before?: string;
  limit?: number;
  offset?: number;
  total: number;
}
