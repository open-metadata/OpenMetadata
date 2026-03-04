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
import { ChangeEvent } from '../generated/type/changeEvent';
import { Paging } from '../generated/type/paging';

export interface AuditLogEntry {
  id?: number;
  changeEventId?: string;
  eventTs?: number;
  eventType?: string;
  userName?: string;
  actorType?: string;
  impersonatedBy?: string;
  serviceName?: string;
  entityType?: string;
  entityId?: string;
  entityFQN?: string;
  createdAt?: number;
  changeEvent?: ChangeEvent;
  /** Human-readable summary of the change event */
  summary?: string;
  /** Raw JSON of the change event - fallback when changeEvent deserialization fails */
  rawEventJson?: string;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  paging: Paging;
  total?: number;
}

export interface AuditLogListParams {
  limit?: number;
  after?: string;
  before?: string;
  userName?: string;
  actorType?: string;
  serviceName?: string;
  entityType?: string;
  entityFQN?: string;
  eventType?: string;
  startTs?: number;
  endTs?: number;
  /** Search term for full-text search across multiple columns */
  q?: string;
}

/** Filter category types for GitHub-style filter dropdown */
export type AuditLogFilterCategoryType = 'time' | 'user' | 'bot' | 'entityType';

/** Individual filter value with display info */
export interface AuditLogFilterValue {
  key: string;
  label: string;
  value: string;
}

/** Active filter representing a selected category and value */
export interface AuditLogActiveFilter {
  category: AuditLogFilterCategoryType;
  categoryLabel: string;
  value: AuditLogFilterValue | TimeFilterValue;
}

/** Time filter preset options */
export type TimeFilterPreset = 'yesterday' | 'thisWeek' | 'custom';

export interface TimeFilterValue extends AuditLogFilterValue {
  startTs?: number;
  endTs?: number;
}

export interface AuditLogExportParams {
  startTs: number;
  endTs: number;
  limit?: number;
  userName?: string;
  actorType?: string;
  serviceName?: string;
  entityType?: string;
  eventType?: string;
  /** Search term for full-text search */
  q?: string;
}

export interface AuditLogExportResponse {
  jobId: string;
  message: string;
}
