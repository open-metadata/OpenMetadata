/*
 *  Copyright 2025 Collate.
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
import { AxiosResponse } from 'axios';
import { BulkColumnUpdatePreview } from '../generated/api/data/bulkColumnUpdatePreview';
import { BulkColumnUpdateRequest } from '../generated/api/data/bulkColumnUpdateRequest';
import { ColumnGridResponse } from '../generated/api/data/columnGridResponse';
import { GroupedColumnsResponse } from '../generated/api/data/groupedColumnsResponse';
import { CSVImportResult } from '../generated/type/csvImportResult';
import APIClient from './index';

export interface CSVImportResponse {
  jobId: string;
  message: string;
}

export interface SearchColumnsParams {
  columnName?: string;
  entityTypes?: string;
  serviceName?: string;
  databaseName?: string;
  schemaName?: string;
  domainId?: string;
}

export interface ExportColumnsParams {
  columnName?: string;
  entityTypes?: string;
  serviceName?: string;
  databaseName?: string;
  schemaName?: string;
  domainId?: string;
}

export interface ImportColumnsParams {
  csv: string;
  dryRun?: boolean;
  entityTypes?: string;
  serviceName?: string;
  databaseName?: string;
  schemaName?: string;
  domainId?: string;
}

export const searchColumns = async (
  params: SearchColumnsParams
): Promise<GroupedColumnsResponse[]> => {
  const queryParams = new URLSearchParams();

  if (params.columnName) {
    queryParams.append('columnName', params.columnName);
  }
  if (params.entityTypes) {
    queryParams.append('entityTypes', params.entityTypes);
  }
  if (params.serviceName) {
    queryParams.append('serviceName', params.serviceName);
  }
  if (params.databaseName) {
    queryParams.append('databaseName', params.databaseName);
  }
  if (params.schemaName) {
    queryParams.append('schemaName', params.schemaName);
  }
  if (params.domainId) {
    queryParams.append('domainId', params.domainId);
  }

  const response = await APIClient.get<GroupedColumnsResponse[]>(
    `/columns/search?${queryParams.toString()}`
  );

  return response.data;
};

export const bulkUpdateColumnsPreview = async (
  request: BulkColumnUpdateRequest
): Promise<BulkColumnUpdatePreview> => {
  const response = await APIClient.post<
    BulkColumnUpdateRequest,
    AxiosResponse<BulkColumnUpdatePreview>
  >('/columns/bulk-update-preview', request);

  return response.data;
};

export const bulkUpdateColumnsAsync = async (
  request: BulkColumnUpdateRequest
): Promise<CSVImportResponse> => {
  const response = await APIClient.post<
    BulkColumnUpdateRequest,
    AxiosResponse<CSVImportResponse>
  >('/columns/bulk-update-async', request);

  return response.data;
};

export const exportColumnsCSV = async (
  params: ExportColumnsParams
): Promise<string> => {
  const queryParams = new URLSearchParams();

  if (params.columnName) {
    queryParams.append('columnName', params.columnName);
  }
  if (params.entityTypes) {
    queryParams.append('entityTypes', params.entityTypes);
  }
  if (params.serviceName) {
    queryParams.append('serviceName', params.serviceName);
  }
  if (params.databaseName) {
    queryParams.append('databaseName', params.databaseName);
  }
  if (params.schemaName) {
    queryParams.append('schemaName', params.schemaName);
  }
  if (params.domainId) {
    queryParams.append('domainId', params.domainId);
  }

  const response = await APIClient.get<string>(
    `/columns/export?${queryParams.toString()}`,
    {
      headers: { Accept: 'text/plain' },
    }
  );

  return response.data;
};

export const importColumnsCSV = async (
  params: ImportColumnsParams
): Promise<CSVImportResult> => {
  const queryParams = new URLSearchParams();

  if (params.dryRun !== undefined) {
    queryParams.append('dryRun', String(params.dryRun));
  }
  if (params.entityTypes) {
    queryParams.append('entityTypes', params.entityTypes);
  }
  if (params.serviceName) {
    queryParams.append('serviceName', params.serviceName);
  }
  if (params.databaseName) {
    queryParams.append('databaseName', params.databaseName);
  }
  if (params.schemaName) {
    queryParams.append('schemaName', params.schemaName);
  }
  if (params.domainId) {
    queryParams.append('domainId', params.domainId);
  }

  const response = await APIClient.post<string, AxiosResponse<CSVImportResult>>(
    `/columns/import?${queryParams.toString()}`,
    params.csv,
    {
      headers: { 'Content-Type': 'text/plain' },
    }
  );

  return response.data;
};

export const importColumnsCSVAsync = async (
  params: ImportColumnsParams
): Promise<CSVImportResponse> => {
  const queryParams = new URLSearchParams();

  if (params.entityTypes) {
    queryParams.append('entityTypes', params.entityTypes);
  }
  if (params.serviceName) {
    queryParams.append('serviceName', params.serviceName);
  }
  if (params.databaseName) {
    queryParams.append('databaseName', params.databaseName);
  }
  if (params.schemaName) {
    queryParams.append('schemaName', params.schemaName);
  }
  if (params.domainId) {
    queryParams.append('domainId', params.domainId);
  }

  const response = await APIClient.post<
    string,
    AxiosResponse<CSVImportResponse>
  >(`/columns/import-async?${queryParams.toString()}`, params.csv, {
    headers: { 'Content-Type': 'text/plain' },
  });

  return response.data;
};

export interface ColumnGridParams {
  size?: number;
  cursor?: string;
  entityTypes?: string[];
  serviceName?: string;
  serviceTypes?: string[];
  databaseName?: string;
  schemaName?: string;
  columnNamePattern?: string;
  metadataStatus?: string[];
  domainId?: string;
  tags?: string[];
  glossaryTerms?: string[];
}

export const getColumnGrid = async (
  params: ColumnGridParams
): Promise<ColumnGridResponse> => {
  const queryParams = new URLSearchParams();

  if (params.size) {
    queryParams.append('size', String(params.size));
  }
  if (params.cursor) {
    queryParams.append('cursor', params.cursor);
  }
  if (params.entityTypes && params.entityTypes.length > 0) {
    queryParams.append('entityTypes', params.entityTypes.join(','));
  }
  if (params.serviceName) {
    queryParams.append('serviceName', params.serviceName);
  }
  if (params.serviceTypes && params.serviceTypes.length > 0) {
    queryParams.append('serviceTypes', params.serviceTypes.join(','));
  }
  if (params.databaseName) {
    queryParams.append('databaseName', params.databaseName);
  }
  if (params.schemaName) {
    queryParams.append('schemaName', params.schemaName);
  }
  if (params.columnNamePattern) {
    queryParams.append('columnNamePattern', params.columnNamePattern);
  }
  if (params.metadataStatus && params.metadataStatus.length > 0) {
    queryParams.append('metadataStatus', params.metadataStatus[0]);
  }
  if (params.domainId) {
    queryParams.append('domainId', params.domainId);
  }
  if (params.tags && params.tags.length > 0) {
    queryParams.append('tags', params.tags.join(','));
  }
  if (params.glossaryTerms && params.glossaryTerms.length > 0) {
    queryParams.append('glossaryTerms', params.glossaryTerms.join(','));
  }

  const response = await APIClient.get<ColumnGridResponse>(
    `/columns/grid?${queryParams.toString()}`
  );

  return response.data;
};
