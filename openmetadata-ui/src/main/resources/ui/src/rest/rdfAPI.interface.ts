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
  EntityGraph,
  GraphNode as EntityGraphNode,
} from '../generated/api/rdf/entityGraph';
import type { GraphEdge } from '../types/knowledgeGraph.types';

export interface GraphNode
  extends Pick<
    EntityGraphNode,
    | 'id'
    | 'type'
    | 'description'
    | 'label'
    | 'name'
    | 'fullyQualifiedName'
    | 'tags'
  > {
  entityId?: EntityGraphNode['entityId'];
  // Human label of the parent glossary (set by the RDF endpoint so the UI
  // hierarchy view can show a group name even when the parent Glossary is
  // not in the caller's accessible glossary list).
  group?: EntityGraphNode['group'];
  // UUID of the parent glossary; supplied by the RDF endpoint when the
  // term-to-glossary membership triple is available.
  glossaryId?: string;
  title?: string;
  isolated?: boolean;
}

export interface GraphData
  extends Partial<
    Pick<
      EntityGraph,
      'filterOptions' | 'totalNodes' | 'totalEdges' | 'truncated'
    >
  > {
  nodes: GraphNode[];
  edges: GraphEdge[];
  source?: `${EntityGraph['source']}` | 'database';
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
  glossaryTermId?: string;
  relationTypes?: string;
  limit?: number;
  offset?: number;
  includeIsolated?: boolean;
}
