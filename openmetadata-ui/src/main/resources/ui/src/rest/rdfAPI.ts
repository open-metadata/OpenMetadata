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

import { RDFStatus } from '../generated/api/rdf/rdfStatus';
import {
  SavedSparqlQueries as SavedSparqlQueriesResponse,
  SavedSparqlQuery as SavedSparqlQueryResponse,
} from '../generated/api/rdf/savedSparqlQueries';
import {
  Format as SparqlResultFormat,
  Inference as SparqlInferenceLevel,
} from '../generated/api/rdf/sparqlQuery';
import { SparqlResponse } from '../generated/api/rdf/sparqlResponse';
import {
  SavedSparqlQuery as SparqlQueryTemplateResponse,
  SparqlQuerySettings,
} from '../generated/configuration/sparqlQuerySettings';
import { SettingType } from '../generated/settings/settings';
import APIClient from './index';
import {
  EntityGraphExportFormat,
  EntityGraphParams,
  GlossaryGraphParams,
  GraphData,
} from './rdfAPI.interface';

export type SparqlPlaygroundFormat = `${SparqlResultFormat}`;
export type SparqlPlaygroundInference = `${SparqlInferenceLevel}`;

export interface SparqlPlaygroundParams {
  query: string;
  format?: SparqlPlaygroundFormat;
  inference?: SparqlPlaygroundInference;
}

export interface SparqlPlaygroundResult {
  format: SparqlPlaygroundFormat;
  body: string;
  parsed?: SparqlResponse;
  contentType: string;
  durationMs: number;
}

export interface SavedSparqlQuery {
  id: string;
  name: string;
  query: string;
  format: SparqlPlaygroundFormat;
  inference: SparqlPlaygroundInference;
  savedAt: number;
}

interface PersistedSparqlQuery {
  id: string;
  name: string;
  query: string;
  format: string;
  inference: string;
  savedAt: number;
}

interface SparqlQuerySettingsUpdate {
  config_type: SettingType.SparqlQuerySettings;
  config_value: SparqlQuerySettings;
}

const SPARQL_RESULT_MIME: Record<SparqlPlaygroundFormat, string> = {
  json: 'application/sparql-results+json',
  xml: 'application/sparql-results+xml',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  turtle: 'text/turtle',
  rdfxml: 'application/rdf+xml',
  ntriples: 'application/n-triples',
  jsonld: 'application/ld+json',
};

const normalizeSparqlFormat = (format: string): SparqlPlaygroundFormat => {
  switch (format) {
    case 'xml':
    case 'csv':
    case 'tsv':
    case 'turtle':
    case 'rdfxml':
    case 'ntriples':
    case 'jsonld':
      return format;
    default:
      return 'json';
  }
};

const normalizeSparqlInference = (
  inference: string
): SparqlPlaygroundInference => {
  switch (inference) {
    case 'rdfs':
    case 'owl':
    case 'custom':
      return inference;
    default:
      return 'none';
  }
};

const normalizeSavedSparqlQuery = (
  savedQuery: PersistedSparqlQuery
): SavedSparqlQuery => ({
  id: savedQuery.id,
  name: savedQuery.name,
  query: savedQuery.query,
  format: normalizeSparqlFormat(savedQuery.format),
  inference: normalizeSparqlInference(savedQuery.inference),
  savedAt: savedQuery.savedAt,
});

export const getSavedSparqlQueries = async (): Promise<SavedSparqlQuery[]> => {
  const response = await APIClient.get<SavedSparqlQueriesResponse>(
    '/rdf/queries/saved'
  );

  return response.data.queries.map((savedQuery: SavedSparqlQueryResponse) =>
    normalizeSavedSparqlQuery(savedQuery)
  );
};

export const replaceSavedSparqlQueries = async (
  queries: SavedSparqlQuery[]
): Promise<SavedSparqlQuery[]> => {
  const response = await APIClient.put<SavedSparqlQueriesResponse>(
    '/rdf/queries/saved',
    { queries }
  );

  return response.data.queries.map((savedQuery: SavedSparqlQueryResponse) =>
    normalizeSavedSparqlQuery(savedQuery)
  );
};

export const getSparqlQueryTemplates = async (): Promise<
  SavedSparqlQuery[]
> => {
  const response = await APIClient.get<SparqlQuerySettings>(
    '/rdf/queries/templates'
  );

  return response.data.queryTemplates.map(
    (queryTemplate: SparqlQueryTemplateResponse) =>
      normalizeSavedSparqlQuery(queryTemplate)
  );
};

export const replaceSparqlQueryTemplates = async (
  queryTemplates: SavedSparqlQuery[]
): Promise<SavedSparqlQuery[]> => {
  const response = await APIClient.put<SparqlQuerySettingsUpdate>(
    '/system/settings',
    {
      config_type: SettingType.SparqlQuerySettings,
      config_value: { queryTemplates },
    }
  );

  return response.data.config_value.queryTemplates.map(
    (queryTemplate: SparqlQueryTemplateResponse) =>
      normalizeSavedSparqlQuery(queryTemplate)
  );
};

/**
 * POST /v1/rdf/sparql. The server returns the result body in the requested
 * SPARQL serialization (JSON/XML/CSV/TSV for SELECT/ASK; Turtle/N-Triples/
 * RDF-XML/JSON-LD for CONSTRUCT/DESCRIBE).
 */
const executeSparqlQuery = async (
  path: string,
  params: SparqlPlaygroundParams
): Promise<SparqlPlaygroundResult> => {
  const format: SparqlPlaygroundFormat = params.format ?? 'json';
  const inference: SparqlPlaygroundInference = params.inference ?? 'none';
  const acceptMime = SPARQL_RESULT_MIME[format];
  const start = performance.now();
  const response = await APIClient.post(
    path,
    {
      query: params.query,
      format,
      inference,
    },
    {
      headers: { Accept: acceptMime },
      transformResponse: [(data) => data],
      responseType: 'text',
    }
  );
  const durationMs = Math.round(performance.now() - start);
  const body = typeof response.data === 'string' ? response.data : '';
  let parsed: SparqlResponse | undefined;
  if (format === 'json') {
    try {
      parsed = JSON.parse(body) as SparqlResponse;
    } catch (e) {
      parsed = undefined;
    }
  }

  return {
    format,
    body,
    parsed,
    contentType:
      typeof response.headers['content-type'] === 'string'
        ? response.headers['content-type']
        : acceptMime,
    durationMs,
  };
};

export const runSparqlQuery = (
  params: SparqlPlaygroundParams
): Promise<SparqlPlaygroundResult> => executeSparqlQuery('/rdf/sparql', params);

export const runGlossarySparqlQuery = (
  glossaryId: string,
  params: SparqlPlaygroundParams
): Promise<SparqlPlaygroundResult> =>
  executeSparqlQuery(`/glossaries/${glossaryId}/sparql`, params);

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
    const response = await APIClient.get<RDFStatus>('/rdf/status');

    return response.data.enabled;
  } catch (error) {
    return false;
  }
};

export const fetchRdfConfig = async (): Promise<RDFStatus> => {
  const response = await APIClient.get<RDFStatus>('/rdf/status');

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

export interface ShaclValidationResult {
  conforms: boolean;
  report: string;
}

export const validateOntologyShapes = async (params?: {
  entityUri?: string;
  format?: 'turtle' | 'jsonld';
}): Promise<ShaclValidationResult> => {
  const { entityUri, format = 'turtle' } = params ?? {};
  const response = await APIClient.post<string>('/rdf/validate', null, {
    headers: {
      Accept: format === 'jsonld' ? 'application/ld+json' : 'text/turtle',
    },
    params: { entityUri, format },
    responseType: 'text',
  });

  return {
    conforms:
      String(response.headers['om-shacl-conforms']).toLowerCase() === 'true',
    report: response.data,
  };
};
