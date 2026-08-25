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
import { isNil, startCase } from 'lodash';
import { create } from 'zustand';
import { getLimitByResource } from '../../rest/limitsAPI';

const ERROR_SUB_HEADER =
  'You have used {{currentCount}} out of {{limit}} of the {{resource}} resource.';

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

export type BannerDetails = {
  header: string;
  subheader: string;
  type: 'warning' | 'danger';
  softLimitExceed?: boolean;
  hardLimitExceed?: boolean;
};

/**
 * Store to manage the limits and resource limits
 */
export const useLimitStore = create<{
  config: null | LimitConfig;
  resourceLimit: Record<string, ResourceLimit['featureLimitStatuses'][number]>;
  bannerDetails: BannerDetails | null;
  getResourceLimit: (
    resource: string,
    showBanner?: boolean,
    force?: boolean
  ) => Promise<ResourceLimit['featureLimitStatuses'][number]>;
  setConfig: (config: LimitConfig) => void;
  setResourceLimit: (
    resource: string,
    limit: ResourceLimit['featureLimitStatuses'][number]
  ) => void;
  setBannerDetails: (details: BannerDetails | null) => void;
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
  setBannerDetails: (details: BannerDetails | null) => {
    set({ bannerDetails: details });
  },
  getResourceLimit: async (
    resource: string,
    showBanner = true,
    force = false
  ) => {
    const { setResourceLimit, resourceLimit, setBannerDetails, config } = get();

    let rLimit = resourceLimit[resource];
    if (config?.enable === false) {
      return {
        name: resource,
        limitReached: false,
        currentCount: -1,
        configuredLimit: {
          name: resource,
          maxVersions: 0,
          disableFields: [],
          limits: {
            softLimit: -1,
            hardLimit: -1,
          },
        },
      } as ResourceLimit['featureLimitStatuses'][number];
    }

    if (isNil(rLimit) || force) {
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

      const softLimitExceed =
        limits.softLimit !== -1 && currentCount >= limits.softLimit;
      const hardLimitExceed =
        limits.hardLimit !== -1 && currentCount >= limits.hardLimit;

      const plan = config?.limits?.config.plan ?? 'FREE';

      (softLimitExceed || hardLimitExceed || limitReached) &&
        showBanner &&
        setBannerDetails({
          header: `You have reached ${
            hardLimitExceed ? '100%' : '75%'
          } of your ${plan} Plan usage limit.`,
          type: hardLimitExceed ? 'danger' : 'warning',
          subheader: ERROR_SUB_HEADER.replace(
            '{{currentCount}}',
            currentCount + ''
          )
            .replace('{{resource}}', startCase(resource))
            .replace('{{limit}}', limits.hardLimit + ''),
          softLimitExceed,
          hardLimitExceed,
        });
    }

    return rLimit;
  },
}));
