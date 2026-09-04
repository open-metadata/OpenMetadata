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

import APIClient from './index';

export interface PendingChangeField {
  name: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface PendingChange {
  requester: string;
  changeDescription: {
    fieldsAdded?: PendingChangeField[];
    fieldsUpdated?: PendingChangeField[];
    fieldsDeleted?: PendingChangeField[];
    previousVersion?: number;
  };
}

// Reads the approval-gated changes held off an entity (GET /{collection}/{id}/pendingChanges).
// The entity keeps serving its approved value; these are the proposals awaiting commit/discard.
export const getPendingChanges = async (
  collection: string,
  id: string,
  user?: string
): Promise<PendingChange[]> => {
  const response = await APIClient.get<PendingChange[]>(
    `/${collection}/${id}/pendingChanges`,
    user ? { params: { user } } : undefined
  );

  return response.data;
};
