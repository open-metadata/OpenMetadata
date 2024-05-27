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
import { isNil } from 'lodash';
import { create } from 'zustand';
import { getLimitByResource } from '../../rest/limitsAPI';

export interface ResourceLimit {
  featureLimitStatuses: Array<{
    configuredLimit: {
      name: string;
      maxVersions?: number;
      disableFields?: Array<string>;
      disabledFields?: Array<string>;
      limits: {
        softLimit: number;
        hardLimit: number;
      };
    };
    limitReached: boolean;
    currentCount: number;
    name: string;
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
        versionHistory: number;
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
  resourceLimit: Record<string, ResourceLimit['featureLimitStatuses'][number]>;
  bannerDetails: {
    header: string;
    subheader: string;
    type: 'warning' | 'danger';
  } | null;
  getResourceLimit: (
    resource: string,
    showBanner?: boolean
  ) => Promise<ResourceLimit['featureLimitStatuses'][number]>;
  setConfig: (config: LimitConfig) => void;
  setResourceLimit: (
    resource: string,
    limit: ResourceLimit['featureLimitStatuses'][number]
  ) => void;
  setBannerDetails: (
    details: {
      header: string;
      subheader: string;
      type: 'warning' | 'danger';
    } | null
  ) => void;
}>()((set, get) => ({
  config: null,
  resourceLimit: {},
  bannerDetails: null,

  setConfig: (config: LimitConfig) => {
    set({ config });
  },
  setResourceLimit: (
    resource: string,
    limit: ResourceLimit['featureLimitStatuses'][number]
  ) => {
    const { resourceLimit } = get();

    set({ resourceLimit: { ...resourceLimit, [resource]: limit } });
  },
  setBannerDetails: (
    details: {
      header: string;
      subheader: string;
      type: 'warning' | 'danger';
    } | null
  ) => {
    set({ bannerDetails: details });
  },
  getResourceLimit: async (resource: string, showBanner = true) => {
    const { setResourceLimit, resourceLimit, setBannerDetails } = get();

    let rLimit = resourceLimit[resource];

    if (isNil(rLimit)) {
      const limit = await getLimitByResource(resource);

      setResourceLimit(resource, limit.featureLimitStatuses[0]);
      rLimit = limit.featureLimitStatuses[0];
    }

    if (rLimit) {
      const {
        configuredLimit: { limits },
        currentCount,
        limitReached,
      } = rLimit;

      limitReached &&
        showBanner &&
        setBannerDetails({
          header: 'Limit Reached',
          type: currentCount > limits.hardLimit ? 'danger' : 'warning',
          subheader: `You have used ${currentCount} out of ${limits.hardLimit} limit`,
        });
    }

    return rLimit;
  },
}));
