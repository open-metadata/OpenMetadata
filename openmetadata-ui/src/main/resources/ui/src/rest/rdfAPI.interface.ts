import { GraphEdge, GraphFilterOptions } from '../types/knowledgeGraph.types';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  group?: string;
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
