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

export interface ResourceLimit {
  featureLimitStatuses: Array<{
    configuredLimit: {
      name: string;
      maxVersions: number;
      disableFields: Array<string>;
      limits: {
        softLimit: number;
        hardLimit: number;
      };
    };
    limitReached: false;
    currentCount: number;
  }>;
}

export type LimitConfig = {
  enable: boolean;
  limits: {
    config: {
      version: string;
      plan: string;
      installationType: string;
      deployment: string;
      companyName: string;
      domain: string;
      instances: number;
      featureLimits: Array<{
        name: string;
        maxVersions: number;
        limits: {
          softLimit: number;
          hardLimit: number;
        };
        disableFields: Array<string>;
        pipelineSchedules?: Array<string>;
      }>;
    };
  };
};

/**
 * Store to manage the limits and resource limits
 */
export const useLimitStore = create<{
  config: null | LimitConfig;
  resourceLimit: Record<string, ResourceLimit>;
  bannerDetails: {
    header: string;
    subheader: string;
  } | null;
  setConfig: (config: LimitConfig) => void;
  setResourceLimit: (resource: string, limit: ResourceLimit) => void;
  setBannerDetails: (
    details: { header: string; subheader: string } | null
  ) => void;
}>()((set, get) => ({
  config: null,
  resourceLimit: {},
  bannerDetails: null,

  setConfig: (config: LimitConfig) => {
    set({ config });
  },
  setResourceLimit: (resource: string, limit: ResourceLimit) => {
    const { resourceLimit } = get();

    set({ resourceLimit: { ...resourceLimit, [resource]: limit } });
  },
  setBannerDetails: (details: { header: string; subheader: string } | null) => {
    set({ bannerDetails: details });
  },
}));
