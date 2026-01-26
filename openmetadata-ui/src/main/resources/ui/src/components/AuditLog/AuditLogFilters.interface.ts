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
  AuditLogActiveFilter,
  AuditLogListParams,
} from '../../types/auditLogs.interface';

export interface AuditLogFiltersProps {
  activeFilters: AuditLogActiveFilter[];
  onFiltersChange: (
    filters: AuditLogActiveFilter[],
    params: Partial<AuditLogListParams>
  ) => void;
}

export interface FilterOption {
  label: string;
  value: string;
  key?: string;
}
