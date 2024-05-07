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
import { LimitsResponse } from '../../generated/system/limitsResponse';

export interface ResourceLimit {
  used: number;
  assetLimits: {
    softLimit: number;
    hardLimit: number;
  };
}

/**
 * Store to manage the limits and resource limits
 */
export const useLimitStore = create<{
  config: null | LimitsResponse;
  resourceLimit: Record<string, ResourceLimit>;
  setConfig: (config: LimitsResponse) => void;
  setResourceLimit: (resource: string, limit: ResourceLimit) => void;
}>()((set, get) => ({
  config: null,
  resourceLimit: {},

  setConfig: (config: LimitsResponse) => {
    set({ config });
  },
  setResourceLimit: (resource: string, limit: ResourceLimit) => {
    const { resourceLimit } = get();

    set({ resourceLimit: { ...resourceLimit, [resource]: limit } });
  },
}));
