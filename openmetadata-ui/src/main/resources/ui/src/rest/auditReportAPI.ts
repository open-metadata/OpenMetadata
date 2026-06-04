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

import { AxiosResponse } from 'axios';
import { EntityReference } from '../generated/type/entityReference';
import { Paging } from '../generated/type/paging';
import APIClient from './index';

export type AuditReportScope = 'Estate' | 'Domain' | 'Asset';
export type AuditReportFormat = 'Json' | 'Pdf' | 'Both';
export type AuditReportStatus =
  | 'Queued'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export interface AuditReportArtifact {
  format: AuditReportFormat;
  downloadUrl: string;
  sizeBytes?: number;
  checksum?: string;
}

export interface AuditReportManifest {
  assetCount?: number;
  frameworkCount?: number;
  controlCount?: number;
  complianceRecordCount?: number;
}

export interface AuditReport {
  id?: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
  description?: string;
  framework?: EntityReference;
  scope: AuditReportScope;
  scopeTarget?: EntityReference;
  format: AuditReportFormat;
  status: AuditReportStatus;
  asOfDate?: number;
  includeRedacted?: boolean;
  requestedBy?: EntityReference;
  requestedAt?: number;
  startedAt?: number;
  completedAt?: number;
  failureReason?: string;
  artifacts?: AuditReportArtifact[];
  manifest?: AuditReportManifest;
  owners?: EntityReference[];
  updatedAt?: number;
  updatedBy?: string;
  version?: number;
}

export interface CreateAuditReport {
  name: string;
  displayName?: string;
  description?: string;
  framework?: string;
  scope?: AuditReportScope;
  scopeTarget?: string;
  format?: AuditReportFormat;
  asOfDate?: number;
  includeRedacted?: boolean;
  owners?: EntityReference[];
}

const BASE = '/auditReports';

export const listReports = async (params?: {
  limit?: number;
  fields?: string;
  status?: AuditReportStatus;
  after?: string;
  before?: string;
}) => {
  const response = await APIClient.get<{
    data: AuditReport[];
    paging: Paging;
  }>(BASE, { params });

  return response.data;
};

export const getReportById = async (id: string, fields?: string) => {
  const response = await APIClient.get<AuditReport>(`${BASE}/${id}`, {
    params: { fields },
  });

  return response.data;
};

export const createReport = async (payload: CreateAuditReport) => {
  const response = await APIClient.post<
    CreateAuditReport,
    AxiosResponse<AuditReport>
  >(BASE, payload);

  return response.data;
};

export const cancelReport = async (id: string) => {
  const response = await APIClient.post<unknown, AxiosResponse<AuditReport>>(
    `${BASE}/${id}/cancel`,
    {}
  );

  return response.data;
};

export const deleteReport = async (id: string, hardDelete = false) => {
  await APIClient.delete(`${BASE}/${id}`, {
    params: { hardDelete, recursive: false },
  });
};

/**
 * The backend embeds JSON artifacts as `data:application/json;base64,...` URLs.
 * Callers can pass an artifact straight to `window.open` or to an anchor's
 * href to trigger a download — no extra fetch round-trip needed.
 */
export const getReportArtifactUrl = (
  report: AuditReport,
  format: AuditReportFormat = 'Json'
): string | null => {
  const match = report.artifacts?.find((a) => a.format === format);

  return match?.downloadUrl ?? null;
};
