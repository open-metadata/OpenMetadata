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

/**
 * The catalog action a single CSV row maps to when the wizard is applied. Shared
 * between the Bulk Import preview (server-classified from the dry-run result) and
 * the Bulk Edit preview (client-classified from the per-row change diff).
 */
export type BulkActionOperation = 'CREATE' | 'UPDATE' | 'NO_CHANGE' | 'SKIP';

export const BULK_ACTION_OPERATIONS: BulkActionOperation[] = [
  'CREATE',
  'UPDATE',
  'NO_CHANGE',
  'SKIP',
];

export interface OperationBadgeProps {
  operation: BulkActionOperation;
  /**
   * Original (server-side) name. When the operation is CREATE because the row was
   * renamed, the badge renders an `originalName → new` hint.
   */
  originalName?: string;
  currentName?: string;
}

export interface OperationSummaryProps {
  summary: Record<BulkActionOperation, number>;
  /**
   * Which operations to show, in order. Defaults to all four; the Import preview
   * passes only CREATE/UPDATE/SKIP since import rows are never "no change".
   */
  operations?: BulkActionOperation[];
}
