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
import { create } from 'zustand';
import type { ApprovalEnforcedEntityTypesStore } from '../interface/store.interface';
import { getApprovalEnforcedEntityTypes } from '../rest/metadataTypeAPI';

/**
 * Entity types an active Enforce-mode workflow gates, read once and shared by every asset page.
 * A workflow saved or deleted in this session invalidates them, so the next reader reads again.
 */
export const useApprovalEnforcedEntityTypesStore =
  create<ApprovalEnforcedEntityTypesStore>((set, get) => ({
    entityTypes: undefined,
    isLoading: false,
    fetchEntityTypes: async () => {
      if (get().entityTypes || get().isLoading) {
        return;
      }
      set({ isLoading: true });
      try {
        set({ entityTypes: await getApprovalEnforcedEntityTypes() });
      } catch {
        // Unread types hide the pending-changes button; a toast on every asset page would only
        // add noise.
      } finally {
        set({ isLoading: false });
      }
    },
    invalidate: () => set({ entityTypes: undefined }),
  }));
