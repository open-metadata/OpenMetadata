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
import { GraphEdge, GraphFilterOptions } from '../types/knowledgeGraph.types';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  // Human label of the parent glossary (set by the RDF endpoint so the UI
  // hierarchy view can show a group name even when the parent Glossary is
  // not in the caller's accessible glossary list).
  group?: string;
  // UUID of the parent glossary; supplied by the RDF endpoint when the
  // term-to-glossary membership triple is available.
  glossaryId?: string;
  title?: string;
  fullyQualifiedName?: string;
  description?: string;
  isolated?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  filterOptions?: GraphFilterOptions;
  totalNodes?: number;
  totalEdges?: number;
  source?: string;
  error?: string;
}

export interface EntityGraphParams {
  entityId: string;
  entityType: string;
  depth?: number;
  entityTypes?: string[];
  relationshipTypes?: string[];
}

export type EntityGraphExportFormat = 'turtle' | 'jsonld';

export interface GlossaryGraphParams {
  glossaryId?: string;
  relationTypes?: string;
  limit?: number;
  offset?: number;
  includeIsolated?: boolean;
}
