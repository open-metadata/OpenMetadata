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

import {
  LimitConfig,
  ResourceLimit,
} from '../../interface/platform/limits.interface';
import { getLimitByResource } from '../../rest/limitsAPI';
import { useLimitStore } from './useLimitsStore';

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

const buildLimitResponse = (opts: {
  name?: string;
  currentCount: number;
  softLimit?: number;
  hardLimit?: number;
  limitReached?: boolean;
}): ResourceLimit => ({
  featureLimitStatuses: [
    {
      configuredLimit: {
        name: opts.name ?? 'user',
        limits: {
          softLimit: opts.softLimit ?? -1,
          hardLimit: opts.hardLimit ?? -1,
        },
      },
      currentCount: opts.currentCount,
      limitReached: opts.limitReached ?? false,
      name: opts.name ?? 'user',
    },
  ],
});

describe('useLimitStore', () => {
  beforeEach(() => {
    useLimitStore.setState({
      config: getConfig(),
      resourceLimit: {},
      bannerDetails: null,
      resourceRequestSeq: {},
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
      resource: 'metric',
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
      resource: 'metric',
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

  it('treats an empty limits response as disabled when the config was never loaded', async () => {
    // config stays null when AppContainer's getLimitConfig call fails, and OSS
    // answers the per-feature call with an empty body; callers must not crash.
    useLimitStore.setState({ config: null });
    mockGetLimitByResource.mockResolvedValue(
      '' as unknown as Awaited<ReturnType<typeof getLimitByResource>>
    );

    const result = await useLimitStore
      .getState()
      .getResourceLimit('eventsubscription', true, true);

    expect(result.currentCount).toBe(-1);
    expect(useLimitStore.getState().bannerDetails).toBeNull();
  });

  describe('setting the banner when a limit is exceeded', () => {
    it('sets a warning banner when the soft limit is exceeded', async () => {
      // count=8, softLimit=7, hardLimit=10 -> over soft, under hard
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 8, softLimit: 7, hardLimit: 10 })
      );

      await useLimitStore.getState().getResourceLimit('user', true, true);

      const banner = useLimitStore.getState().bannerDetails;

      expect(banner).not.toBeNull();
      expect(banner?.type).toBe('warning');
      expect(banner?.subheader).toBe('8/10 (FREE, 70%)');
      expect(banner?.softLimitExceed).toBe(true);
      expect(banner?.hardLimitExceed).toBe(false);
      expect(banner?.resource).toBe('user');
    });

    it('sets a danger banner when the hard limit is exceeded', async () => {
      // count=11, softLimit=7, hardLimit=10 -> over both soft and hard
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 11, softLimit: 7, hardLimit: 10 })
      );

      await useLimitStore.getState().getResourceLimit('user', true, true);

      const banner = useLimitStore.getState().bannerDetails;

      expect(banner).not.toBeNull();
      expect(banner?.type).toBe('danger');
      expect(banner?.subheader).toBe('11/10 (FREE, 100%)');
      expect(banner?.softLimitExceed).toBe(true);
      expect(banner?.hardLimitExceed).toBe(true);
      expect(banner?.resource).toBe('user');
    });

    it('sets the banner when the API reports limitReached even if local thresholds are not crossed', async () => {
      // count=3, softLimit=7, hardLimit=10 -> under thresholds, but API says reached
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          currentCount: 3,
          softLimit: 7,
          hardLimit: 10,
          limitReached: true,
        })
      );

      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails).not.toBeNull();
      expect(useLimitStore.getState().bannerDetails?.resource).toBe('user');
    });

    it('tags the banner with the requesting resource name', async () => {
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'bot',
          currentCount: 9,
          softLimit: 5,
          hardLimit: 10,
        })
      );

      await useLimitStore.getState().getResourceLimit('bot', true, true);

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('bot');
    });
  });

  describe('clearing the banner when usage drops below the limit', () => {
    it('clears a previously-set banner when the owning resource drops below the soft/hard limit on a force refresh', async () => {
      // First fetch: over soft limit -> banner set with count=8
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 8, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      const bannerAfterFirstFetch = useLimitStore.getState().bannerDetails;

      expect(bannerAfterFirstFetch).not.toBeNull();
      expect(bannerAfterFirstFetch?.subheader).toBe('8/10 (FREE, 70%)');

      // Second fetch (force): usage drops to 5 -> below both limits
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 5, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails).toBeNull();
    });

    it('clears a hard-limit banner when usage drops back below the soft limit', async () => {
      // over hard limit
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 12, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.type).toBe('danger');

      // back below soft limit
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 3, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails).toBeNull();
    });

    it('updates (does not clear) the banner when usage drops from hard limit to still over soft limit', async () => {
      // over hard limit (count=12)
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 12, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.type).toBe('danger');
      expect(useLimitStore.getState().bannerDetails?.subheader).toBe(
        '12/10 (FREE, 100%)'
      );

      // still over soft limit but back under hard limit (count=8)
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 8, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      const banner = useLimitStore.getState().bannerDetails;

      expect(banner).not.toBeNull();
      expect(banner?.type).toBe('warning');
      expect(banner?.subheader).toBe('8/10 (FREE, 70%)');
    });
  });

  describe('cross-resource banner ownership safety', () => {
    it('does not clear a banner owned by another resource when a different resource refreshes below its limit', async () => {
      // bot is over its hard limit -> bot owns the banner
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'bot',
          currentCount: 20,
          softLimit: 5,
          hardLimit: 10,
        })
      );
      await useLimitStore.getState().getResourceLimit('bot', true, true);
      const botBanner = useLimitStore.getState().bannerDetails;

      expect(botBanner?.resource).toBe('bot');

      // user (different resource) refresh comes back under its limits
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'user',
          currentCount: 2,
          softLimit: 7,
          hardLimit: 10,
        })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      // The bot banner must survive the unrelated, sub-limit user refresh.
      const survivingBanner = useLimitStore.getState().bannerDetails;

      expect(survivingBanner).not.toBeNull();
      expect(survivingBanner?.resource).toBe('bot');
    });

    it('clears the banner when the owner resource later drops below its limit, after an unrelated sub-limit refresh left it in place', async () => {
      // bot over hard limit -> bot banner
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'bot',
          currentCount: 20,
          softLimit: 5,
          hardLimit: 10,
        })
      );
      await useLimitStore.getState().getResourceLimit('bot', true, true);

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('bot');

      // unrelated user sub-limit refresh must NOT clear the bot banner
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'user',
          currentCount: 2,
          softLimit: 7,
          hardLimit: 10,
        })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('bot');

      // now bot itself drops below its limit -> bot banner should clear
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'bot',
          currentCount: 1,
          softLimit: 5,
          hardLimit: 10,
        })
      );
      await useLimitStore.getState().getResourceLimit('bot', true, true);

      expect(useLimitStore.getState().bannerDetails).toBeNull();
    });

    it('replaces the banner owner when a different resource goes over its limit', async () => {
      // user over soft limit
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 8, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('user');

      // bot now over hard limit -> ownership transfers to bot
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'bot',
          currentCount: 20,
          softLimit: 5,
          hardLimit: 10,
        })
      );
      await useLimitStore.getState().getResourceLimit('bot', true, true);

      const banner = useLimitStore.getState().bannerDetails;

      expect(banner?.resource).toBe('bot');
      expect(banner?.type).toBe('danger');
    });

    it('does not clear a user-owned banner when a delayed sub-limit bot response was captured against a stale bot banner', async () => {
      // Ownership must be re-checked against the live store when each response
      // is applied: a slow refresh that captured an older banner must not clear
      // a banner a faster refresh has since installed for another resource.
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'bot',
          currentCount: 20,
          softLimit: 5,
          hardLimit: 10,
        })
      );
      await useLimitStore.getState().getResourceLimit('bot', true, true);

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('bot');

      let resolveBotRefresh: (value: ResourceLimit) => void = () => {};
      mockGetLimitByResource.mockReturnValueOnce(
        new Promise<ResourceLimit>((resolve) => {
          resolveBotRefresh = resolve;
        })
      );
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'user',
          currentCount: 20,
          softLimit: 5,
          hardLimit: 10,
        })
      );

      const botRefresh = useLimitStore
        .getState()
        .getResourceLimit('bot', true, true);
      const userRefresh = useLimitStore
        .getState()
        .getResourceLimit('user', true, true);

      // The user refresh resolves first and takes ownership of the banner.
      await userRefresh;

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('user');

      // The delayed bot refresh returns sub-limit, but it captured the stale
      // bot banner before the user banner existed; it must not clear the
      // current user-owned banner.
      resolveBotRefresh(
        buildLimitResponse({
          name: 'bot',
          currentCount: 1,
          softLimit: 5,
          hardLimit: 10,
        })
      );
      await botRefresh;

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('user');
    });
  });

  describe('same-resource request sequencing', () => {
    it('does not clear a banner set by a newer same-resource response when an older sub-limit response resolves last', async () => {
      // Two overlapping force fetches for the same resource resolve out of
      // order: the later-started over-limit fetch must own the banner, and
      // the earlier-started sub-limit fetch must not drop it. Without
      // per-resource request sequencing the stale reply would re-check
      // ownership, see the banner belongs to the same resource, and clear
      // a valid over-limit banner.
      let resolveSubLimit: (value: ResourceLimit) => void = () => {};
      let resolveOverLimit: (value: ResourceLimit) => void = () => {};

      // Older request (started first) returns sub-limit data.
      mockGetLimitByResource.mockReturnValueOnce(
        new Promise<ResourceLimit>((resolve) => {
          resolveSubLimit = resolve;
        })
      );
      // Newer request (started second) returns over-limit data.
      mockGetLimitByResource.mockReturnValueOnce(
        new Promise<ResourceLimit>((resolve) => {
          resolveOverLimit = resolve;
        })
      );

      const subLimitRefresh = useLimitStore
        .getState()
        .getResourceLimit('user', true, true);
      const overLimitRefresh = useLimitStore
        .getState()
        .getResourceLimit('user', true, true);

      // The newer request wins: resolve it first and install the banner.
      resolveOverLimit(
        buildLimitResponse({ currentCount: 11, softLimit: 7, hardLimit: 10 })
      );
      await overLimitRefresh;

      const bannerAfterNewer = useLimitStore.getState().bannerDetails;

      expect(bannerAfterNewer?.resource).toBe('user');
      expect(bannerAfterNewer?.type).toBe('danger');
      expect(bannerAfterNewer?.subheader).toBe('11/10 (FREE, 100%)');

      // The older sub-limit reply resolves last and must not clobber the
      // newer over-limit banner or the cached resourceLimit.
      resolveSubLimit(
        buildLimitResponse({ currentCount: 3, softLimit: 7, hardLimit: 10 })
      );
      await subLimitRefresh;

      const survivingBanner = useLimitStore.getState().bannerDetails;

      expect(survivingBanner?.resource).toBe('user');
      expect(survivingBanner?.type).toBe('danger');
      expect(survivingBanner?.subheader).toBe('11/10 (FREE, 100%)');
      expect(
        useLimitStore.getState().resourceLimit.user.currentCount
      ).toBe(11);
    });
  });

  describe('showBanner=false leaves the banner untouched', () => {
    it('does not set the banner when showBanner is false and the limit is exceeded', async () => {
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 12, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', false, true);

      expect(useLimitStore.getState().bannerDetails).toBeNull();
    });

    it('does not clear an existing banner when showBanner is false even if usage is sub-limit', async () => {
      // pre-seed a banner as if a LimitWrapper had set it
      useLimitStore.setState({
        bannerDetails: {
          header: 'server.entity-limit-reached',
          subheader: '12/10 (FREE, 100%)',
          type: 'danger',
          softLimitExceed: true,
          hardLimitExceed: true,
          resource: 'user',
        },
      });

      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 2, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', false, true);

      // showBanner=false callers (e.g. Users.component read-only checks) must
      // not mutate the shared banner.
      expect(useLimitStore.getState().bannerDetails).not.toBeNull();
      expect(useLimitStore.getState().bannerDetails?.subheader).toBe(
        '12/10 (FREE, 100%)'
      );
    });
  });

  describe('disabled limits config', () => {
    it('returns a sentinel sub-limit and never touches the banner when config.enable is false', async () => {
      useLimitStore.setState({ config: { ...getConfig(), enable: false } });
      // pre-seed a banner to prove the disabled path does not clear it
      useLimitStore.setState({
        bannerDetails: {
          header: 'pre-existing',
          subheader: 'pre-existing',
          type: 'warning',
          resource: 'user',
        },
      });

      const result = await useLimitStore
        .getState()
        .getResourceLimit('user', true, true);

      expect(result.currentCount).toBe(-1);
      expect(result.limitReached).toBe(false);
      // No API call should be made when limits are disabled.
      expect(mockGetLimitByResource).not.toHaveBeenCalled();
      // Banner must be left intact.
      expect(useLimitStore.getState().bannerDetails).not.toBeNull();
      expect(useLimitStore.getState().bannerDetails?.header).toBe(
        'pre-existing'
      );
    });
  });

  describe('cached (non-force) refresh', () => {
    it('does not re-fetch and reflects cached state on a non-force call', async () => {
      // Prime the cache with an over-limit value via a force fetch.
      mockGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 9, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.subheader).toBe(
        '9/10 (FREE, 70%)'
      );

      // Non-force call: no new API call; cached count=9 still drives the banner.
      const result = await useLimitStore.getState().getResourceLimit('user');

      expect(mockGetLimitByResource).toHaveBeenCalledTimes(1);
      expect(result.currentCount).toBe(9);
      expect(useLimitStore.getState().bannerDetails?.subheader).toBe(
        '9/10 (FREE, 70%)'
      );
    });
  });
});
