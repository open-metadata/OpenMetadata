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

import { getLimitByResource } from '../../rest/limitsAPI';
import { LimitConfig, useLimitStore } from './useLimitsStore';

jest.mock('../../rest/limitsAPI');

const mockGetLimitByResource = getLimitByResource as jest.MockedFunction<
  typeof getLimitByResource
>;

const getConfig = (): LimitConfig => ({
  enable: true,
  limits: {
    config: {
      version: 'test',
      plan: 'FREE',
      installationType: 'test',
      deployment: 'test',
      companyName: 'test',
      domain: 'test',
      instances: 1,
      featureLimits: [],
    },
  },
});

const getLimitResponse = (currentCount: number, limitReached = false) => ({
  featureLimitStatuses: [
    {
      name: 'metric',
      limitReached,
      currentCount,
      configuredLimit: {
        name: 'metric',
        limits: {
          softLimit: 2,
          hardLimit: 3,
        },
      },
    },
  ],
});

describe('useLimitStore', () => {
  beforeEach(() => {
    useLimitStore.setState({
      config: getConfig(),
      resourceLimit: {},
      bannerDetails: null,
    });
    mockGetLimitByResource.mockReset();
  });

  it('localizes the Metric hard-limit banner', async () => {
    mockGetLimitByResource.mockResolvedValue(getLimitResponse(3, true));

    await useLimitStore.getState().getResourceLimit('metric');

    expect(useLimitStore.getState().bannerDetails).toEqual({
      header: 'server.entity-limit-reached',
      subheader: '3/3 (FREE, 100%)',
      type: 'danger',
      hardLimitExceed: true,
      softLimitExceed: true,
    });
  });

  it('uses the warning state and localized header at the soft limit', async () => {
    mockGetLimitByResource.mockResolvedValue(getLimitResponse(2));

    await useLimitStore.getState().getResourceLimit('metric');

    expect(useLimitStore.getState().bannerDetails).toEqual({
      header: 'server.entity-limit-reached',
      subheader: '2/3 (FREE, 67%)',
      type: 'warning',
      hardLimitExceed: false,
      softLimitExceed: true,
    });
  });

  it('does not request or banner a disabled limit configuration', async () => {
    useLimitStore.setState({ config: { ...getConfig(), enable: false } });

    const result = await useLimitStore.getState().getResourceLimit('metric');

    expect(result.currentCount).toBe(-1);
    expect(mockGetLimitByResource).not.toHaveBeenCalled();
    expect(useLimitStore.getState().bannerDetails).toBeNull();
  });

  it('can fetch without changing the global banner', async () => {
    mockGetLimitByResource.mockResolvedValue(getLimitResponse(3, true));

    await useLimitStore.getState().getResourceLimit('metric', false);

    expect(useLimitStore.getState().bannerDetails).toBeNull();
  });
});
