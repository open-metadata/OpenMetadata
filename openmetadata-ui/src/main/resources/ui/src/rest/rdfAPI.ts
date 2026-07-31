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

import APIClient from './index';
import {
  EntityGraphExportFormat,
  EntityGraphParams,
  GlossaryGraphParams,
  GraphData,
} from './rdfAPI.interface';

export const EXPORT_FORMAT_TO_ACCEPT_HEADER: Record<string, string> = {
  jsonld: 'application/ld+json',
  turtle: 'text/turtle',
  rdfxml: 'application/rdf+xml',
  ntriples: 'application/n-triples',
};

export const EXPORT_FORMAT_TO_FILE_EXTENSION: Record<string, string> = {
  jsonld: 'jsonld',
  turtle: 'ttl',
  rdfxml: 'rdf',
  ntriples: 'nt',
};

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
  params: EntityGraphParams,
  options?: { signal?: AbortSignal }
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
    signal: options?.signal,
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
  const safeFilename = entityName.replaceAll(/[^a-zA-Z0-9-_]/g, '_');
  const extension = format === 'jsonld' ? 'jsonld' : 'ttl';
  const filename = `${safeFilename}_knowledge_graph.${extension}`;
  const downloadBlob =
    blob instanceof Blob ? blob : new Blob([blob], { type: 'text/plain' });

  const url = globalThis.URL.createObjectURL(downloadBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    link.remove();
    globalThis.URL.revokeObjectURL(url);
  }, 100);
};

export const getGlossaryTermGraph = async (
  params: GlossaryGraphParams = {}
): Promise<GraphData> => {
  const {
    glossaryId,
    glossaryTermId,
    relationTypes,
    limit = 500,
    offset = 0,
    includeIsolated = true,
  } = params;

  const response = await APIClient.get<GraphData>('/rdf/glossary/graph', {
    params: {
      glossaryId,
      glossaryTermId,
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
  const acceptHeader =
    EXPORT_FORMAT_TO_ACCEPT_HEADER[format] || 'application/ld+json';

  const response = await APIClient.get(`/rdf/glossary/${glossaryId}/export`, {
    params: {
      format,
      includeRelations,
    },
    responseType: 'blob',
    headers: {
      Accept: acceptHeader,
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

  const extension = EXPORT_FORMAT_TO_FILE_EXTENSION[format] || 'jsonld';

  const safeFilename = glossaryName.replaceAll(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${safeFilename}_ontology.${extension}`;

  // Create blob if response is text
  const downloadBlob =
    blob instanceof Blob ? blob : new Blob([blob], { type: 'text/plain' });

  const url = globalThis.URL.createObjectURL(downloadBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);

  // Trigger download
  link.click();

  // Cleanup
  setTimeout(() => {
    link.remove();
    globalThis.URL.revokeObjectURL(url);
  }, 100);
};
