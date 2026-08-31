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

import {
  AuditLogExportJob,
  AuditLogExportParams,
  AuditLogExportResponse,
  AuditLogListParams,
  AuditLogListResponse,
} from '../types/auditLogs.interface';
import APIClient from './index';

const BASE_URL = '/audit/logs';

export const getAuditLogs = async (params: AuditLogListParams) => {
  const response = await APIClient.get<AuditLogListResponse>(BASE_URL, {
    params,
  });

  return response.data;
};

export const exportAuditLogs = async (
  params: AuditLogExportParams
): Promise<AuditLogExportResponse> => {
  const response = await APIClient.get<AuditLogExportResponse>(
    `${BASE_URL}/export`,
    {
      params,
    }
  );

  return response.data;
};

/**
 * Reports an export job's progress and terminal state. Polled as the fallback for
 * the completion websocket event, which only reaches sockets held by the server
 * that ran the job — on a multi-server deployment that is rarely the client's.
 */
export const getAuditLogExportJob = async (
  jobId: string
): Promise<AuditLogExportJob> => {
  const response = await APIClient.get<AuditLogExportJob>(
    `${BASE_URL}/export/${jobId}`
  );

  return response.data;
};

/**
 * Fetches a completed export's payload. The completion websocket event carries
 * only the job status — the export itself can be arbitrarily large, so it is
 * stored server-side and downloaded from any server through this endpoint.
 */
export const getAuditLogExportResult = async (
  jobId: string
): Promise<string> => {
  const response = await APIClient.get<string>(
    `${BASE_URL}/export/${jobId}/result`,
    { responseType: 'text' }
  );

  return response.data;
};
