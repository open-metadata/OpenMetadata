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
import { BulkColumnUpdateRequest } from '../generated/api/data/bulkColumnUpdateRequest';
import { ColumnGridResponse } from '../generated/api/data/columnGridResponse';
import APIClient from './axiosClient';

export interface CSVImportResponse {
  jobId: string;
  message: string;
}

export const bulkUpdateColumnsAsync = async (
  request: BulkColumnUpdateRequest
): Promise<CSVImportResponse> => {
  const response = await APIClient.post<
    BulkColumnUpdateRequest,
    AxiosResponse<CSVImportResponse>
  >('/columns/bulk-update-async', request);

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

const appendStringParam = (
  queryParams: URLSearchParams,
  key: string,
  value?: string
): void => {
  if (value) {
    queryParams.append(key, value);
  }
};

const appendListParam = (
  queryParams: URLSearchParams,
  key: string,
  value?: string[]
): void => {
  if (value && value.length > 0) {
    queryParams.append(key, value.join(','));
  }
};

export const getColumnGrid = async (
  params: ColumnGridParams
): Promise<ColumnGridResponse> => {
  const queryParams = new URLSearchParams();

  appendStringParam(
    queryParams,
    'size',
    params.size ? String(params.size) : undefined
  );
  appendStringParam(queryParams, 'cursor', params.cursor);
  appendListParam(queryParams, 'entityTypes', params.entityTypes);
  appendStringParam(queryParams, 'serviceName', params.serviceName);
  appendListParam(queryParams, 'serviceTypes', params.serviceTypes);
  appendStringParam(queryParams, 'databaseName', params.databaseName);
  appendStringParam(queryParams, 'schemaName', params.schemaName);
  appendStringParam(queryParams, 'columnNamePattern', params.columnNamePattern);
  if (params.metadataStatus && params.metadataStatus.length > 0) {
    queryParams.append('metadataStatus', params.metadataStatus[0]);
  }
  appendStringParam(queryParams, 'domainId', params.domainId);
  appendListParam(queryParams, 'tags', params.tags);
  appendListParam(queryParams, 'glossaryTerms', params.glossaryTerms);

  const response = await APIClient.get<ColumnGridResponse>(
    `/columns/grid?${queryParams.toString()}`
  );

  return response.data;
};
