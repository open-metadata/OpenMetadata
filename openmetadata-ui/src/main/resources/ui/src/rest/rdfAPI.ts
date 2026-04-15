/*
 *  Copyright 2024 Collate.
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
import APIClient from './index';

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

export const checkRdfEnabled = async (): Promise<boolean> => {
  try {
    const response = await APIClient.get('/rdf/status');

    return response.data?.enabled ?? false;
  } catch (error) {
    return false;
  }
};

export const fetchRdfConfig = async (): Promise<{ enabled: boolean }> => {
  const response = await APIClient.get<{ enabled: boolean }>('/rdf/status');

  return response.data;
};

export const getEntityGraphData = async (
  params: EntityGraphParams
): Promise<GraphData> => {
  const {
    entityId,
    entityType,
    depth = 2,
    entityTypes,
    relationshipTypes,
  } = params;
  const response = await APIClient.get(`/rdf/graph/explore`, {
    params: {
      entityId,
      entityType,
      depth,
      entityTypes: entityTypes?.length ? entityTypes.join(',') : undefined,
      relationshipTypes: relationshipTypes?.length
        ? relationshipTypes.join(',')
        : undefined,
    },
  });

  return response.data;
};

export const exportEntityGraph = async (
  params: EntityGraphParams & {
    format?: EntityGraphExportFormat;
  }
): Promise<Blob> => {
  const {
    entityId,
    entityType,
    depth = 2,
    entityTypes,
    relationshipTypes,
    format = 'turtle',
  } = params;

  const response = await APIClient.get('/rdf/graph/explore/export', {
    params: {
      entityId,
      entityType,
      depth,
      entityTypes: entityTypes?.length ? entityTypes.join(',') : undefined,
      relationshipTypes: relationshipTypes?.length
        ? relationshipTypes.join(',')
        : undefined,
      format,
    },
    responseType: 'blob',
    headers: {
      Accept: format === 'jsonld' ? 'application/ld+json' : 'text/turtle',
    },
  });

  return response.data;
};

export const downloadEntityGraph = async (
  params: EntityGraphParams & {
    entityName: string;
    format?: EntityGraphExportFormat;
  }
): Promise<void> => {
  const { entityName, format = 'turtle', ...graphParams } = params;
  const blob = await exportEntityGraph({ ...graphParams, format });
  const safeFilename = entityName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const extension = format === 'jsonld' ? 'jsonld' : 'ttl';
  const filename = `${safeFilename}_knowledge_graph.${extension}`;
  const downloadBlob =
    blob instanceof Blob ? blob : new Blob([blob], { type: 'text/plain' });

  const url = window.URL.createObjectURL(downloadBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 100);
};

export const getGlossaryTermGraph = async (
  params: GlossaryGraphParams = {}
): Promise<GraphData> => {
  const {
    glossaryId,
    relationTypes,
    limit = 500,
    offset = 0,
    includeIsolated = true,
  } = params;

  const response = await APIClient.get<GraphData>('/rdf/glossary/graph', {
    params: {
      glossaryId,
      relationTypes,
      limit,
      offset,
      includeIsolated,
    },
  });

  return response.data;
};

export type OntologyExportFormat = 'turtle' | 'rdfxml' | 'ntriples' | 'jsonld';

export interface ExportGlossaryParams {
  glossaryId: string;
  format?: OntologyExportFormat;
  includeRelations?: boolean;
}

export const exportGlossaryAsOntology = async (
  params: ExportGlossaryParams
): Promise<Blob> => {
  const { glossaryId, format = 'turtle', includeRelations = true } = params;

  const response = await APIClient.get(`/rdf/glossary/${glossaryId}/export`, {
    params: {
      format,
      includeRelations,
    },
    responseType: 'blob',
    headers: {
      Accept:
        format === 'turtle'
          ? 'text/turtle'
          : format === 'rdfxml'
          ? 'application/rdf+xml'
          : format === 'ntriples'
          ? 'application/n-triples'
          : 'application/ld+json',
    },
  });

  return response.data;
};

export const downloadGlossaryOntology = async (
  glossaryId: string,
  glossaryName: string,
  format: OntologyExportFormat = 'turtle'
): Promise<void> => {
  const blob = await exportGlossaryAsOntology({ glossaryId, format });

  const extension =
    format === 'turtle'
      ? 'ttl'
      : format === 'rdfxml'
      ? 'rdf'
      : format === 'ntriples'
      ? 'nt'
      : 'jsonld';

  const safeFilename = glossaryName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${safeFilename}_ontology.${extension}`;

  // Create blob if response is text
  const downloadBlob =
    blob instanceof Blob ? blob : new Blob([blob], { type: 'text/plain' });

  const url = window.URL.createObjectURL(downloadBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);

  // Trigger download
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 100);
};
