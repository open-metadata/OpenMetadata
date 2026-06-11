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
import { AxiosError, AxiosResponse } from 'axios';
import APIClient from './index';

export interface CsvHeaderDocumentation {
  name: string;
  required?: boolean;
  description?: string;
  examples?: string[];
}

export interface CsvDocumentation {
  summary?: string;
  headers: CsvHeaderDocumentation[];
}

export type CsvAsyncJobOperation = 'IMPORT' | 'EXPORT';

export type CsvAsyncJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED';

export interface CsvAsyncJobLog {
  logId: string;
  jobId: string;
  createdAt: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface CsvAsyncJob {
  jobId: string;
  operation: CsvAsyncJobOperation;
  entityType: string;
  targetFqn?: string;
  createdBy: string;
  status: CsvAsyncJobStatus;
  progress?: number;
  total?: number;
  dryRun?: boolean;
  recursive?: boolean;
  result?: string;
  error?: string;
  message?: string;
  cancelRequested?: boolean;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
  logs?: CsvAsyncJobLog[];
}

const CSV_DOCUMENTATION_FALLBACK_PATHS: Record<string, string> = {
  glossary: '/glossaries/documentation/csv',
  metric: '/metrics/documentation/csv',
  team: '/teams/documentation/csv',
  user: '/users/documentation/csv',
};

export const getCsvDocumentation = async (
  entityType: string,
  recursive = false
) => {
  try {
    const response = await APIClient.get<CsvDocumentation>(
      `/csv/documentation/${entityType}?recursive=${recursive}`
    );

    return response.data;
  } catch (error) {
    const fallbackPath = CSV_DOCUMENTATION_FALLBACK_PATHS[entityType];
    const isGenericEndpointMissing =
      (error as AxiosError).response?.status === 404;

    if (!fallbackPath || !isGenericEndpointMissing) {
      throw error;
    }

    const response = await APIClient.get<CsvDocumentation>(
      `${fallbackPath}?recursive=${recursive}`
    );

    return response.data;
  }
};

export const getCsvAsyncJobs = async (limit = 20) => {
  const response = await APIClient.get<CsvAsyncJob[]>(
    `/csvAsyncJobs?limit=${limit}`
  );

  return response.data;
};

export const getCsvAsyncJob = async (jobId: string) => {
  const response = await APIClient.get<CsvAsyncJob>(`/csvAsyncJobs/${jobId}`);

  return response.data;
};

// Export results are intentionally omitted from the jobs list (they can be
// arbitrarily large); download a single job's CSV through this endpoint.
export const getCsvAsyncJobResult = async (jobId: string) => {
  const response = await APIClient.get<string>(
    `/csvAsyncJobs/${jobId}/result`,
    {
      headers: { Accept: 'text/csv' },
      responseType: 'text',
    }
  );

  return response.data;
};

export const cancelCsvAsyncJob = async (jobId: string) => {
  const response = await APIClient.put<string, AxiosResponse<CsvAsyncJob>>(
    `/csvAsyncJobs/${jobId}/cancel`
  );

  return response.data;
};
