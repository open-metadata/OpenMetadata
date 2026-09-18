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
import { getLimitByResource } from '../../rest/limitsAPI';
import { LimitConfig, ResourceLimit, useLimitStore } from './useLimitsStore';

jest.mock('../../rest/limitsAPI', () => ({
  getLimitByResource: jest.fn(),
}));

const mockedGetLimitByResource = getLimitByResource as jest.MockedFunction<
  typeof getLimitByResource
>;

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

const ENABLED_CONFIG = {
  enable: true,
  limits: { config: { plan: 'FREE' } },
} as LimitConfig;

describe('useLimitStore.getResourceLimit banner management', () => {
  beforeEach(() => {
    mockedGetLimitByResource.mockReset();
    useLimitStore.setState({
      config: ENABLED_CONFIG,
      resourceLimit: {},
      bannerDetails: null,
    });
  });

  describe('setting the banner when a limit is exceeded', () => {
    it('sets a warning banner when the soft limit is exceeded', async () => {
      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 8, softLimit: 7, hardLimit: 10 })
      );

      await useLimitStore.getState().getResourceLimit('user', true, true);

      const banner = useLimitStore.getState().bannerDetails;

      expect(banner).not.toBeNull();
      expect(banner?.type).toBe('warning');
      expect(banner?.header).toContain('75%');
      expect(banner?.softLimitExceed).toBe(true);
      expect(banner?.hardLimitExceed).toBe(false);
      expect(banner?.resource).toBe('user');
      expect(banner?.subheader).toBe(
        'You have used 8 out of 10 of the User resource.'
      );
    });

    it('sets a danger banner when the hard limit is exceeded', async () => {
      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 11, softLimit: 7, hardLimit: 10 })
      );

      await useLimitStore.getState().getResourceLimit('user', true, true);

      const banner = useLimitStore.getState().bannerDetails;

      expect(banner).not.toBeNull();
      expect(banner?.type).toBe('danger');
      expect(banner?.header).toContain('100%');
      expect(banner?.softLimitExceed).toBe(true);
      expect(banner?.hardLimitExceed).toBe(true);
      expect(banner?.resource).toBe('user');
    });

    it('sets the banner when the API reports limitReached even if local thresholds are not crossed', async () => {
      mockedGetLimitByResource.mockResolvedValueOnce(
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
      mockedGetLimitByResource.mockResolvedValueOnce(
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
      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 8, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      const bannerAfterFirstFetch = useLimitStore.getState().bannerDetails;

      expect(bannerAfterFirstFetch).not.toBeNull();
      expect(bannerAfterFirstFetch?.subheader).toContain(
        'You have used 8 out of 10 of the User resource.'
      );

      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 5, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails).toBeNull();
    });

    it('clears a hard-limit banner when usage drops back below the soft limit', async () => {
      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 12, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.type).toBe('danger');

      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 3, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails).toBeNull();
    });

    it('updates (does not clear) the banner when usage drops from hard limit to still over soft limit', async () => {
      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 12, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.type).toBe('danger');
      expect(useLimitStore.getState().bannerDetails?.subheader).toContain(
        'You have used 12 out of 10'
      );

      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 8, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      const banner = useLimitStore.getState().bannerDetails;

      expect(banner).not.toBeNull();
      expect(banner?.type).toBe('warning');
      expect(banner?.subheader).toContain('You have used 8 out of 10');
    });
  });

  describe('cross-resource banner ownership safety', () => {
    it('does not clear a banner owned by another resource when a different resource refreshes below its limit', async () => {
      mockedGetLimitByResource.mockResolvedValueOnce(
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
      expect(botBanner?.subheader).toContain('Bot resource');

      mockedGetLimitByResource.mockResolvedValueOnce(
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
      expect(survivingBanner?.subheader).toContain('Bot resource');
    });

    it('clears the banner when the owner resource later drops below its limit, after an unrelated sub-limit refresh left it in place', async () => {
      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'bot',
          currentCount: 20,
          softLimit: 5,
          hardLimit: 10,
        })
      );
      await useLimitStore.getState().getResourceLimit('bot', true, true);

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('bot');

      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({
          name: 'user',
          currentCount: 2,
          softLimit: 7,
          hardLimit: 10,
        })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('bot');

      mockedGetLimitByResource.mockResolvedValueOnce(
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
      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 8, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.resource).toBe('user');

      mockedGetLimitByResource.mockResolvedValueOnce(
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
      mockedGetLimitByResource.mockResolvedValueOnce(
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
      mockedGetLimitByResource.mockReturnValueOnce(
        new Promise<ResourceLimit>((resolve) => {
          resolveBotRefresh = resolve;
        })
      );
      mockedGetLimitByResource.mockResolvedValueOnce(
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

  describe('showBanner=false leaves the banner untouched', () => {
    it('does not set the banner when showBanner is false and the limit is exceeded', async () => {
      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 12, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', false, true);

      expect(useLimitStore.getState().bannerDetails).toBeNull();
    });

    it('does not clear an existing banner when showBanner is false even if usage is sub-limit', async () => {
      // Pre-seed a banner as if a LimitWrapper had set it.
      useLimitStore.setState({
        bannerDetails: {
          header: 'You have reached 100% of your FREE Plan usage limit.',
          subheader: 'You have used 12 out of 10 of the User resource.',
          type: 'danger',
          softLimitExceed: true,
          hardLimitExceed: true,
          resource: 'user',
        },
      });

      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 2, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', false, true);

      // showBanner=false callers (e.g. Users.component read-only checks) must
      // not mutate the shared banner.
      expect(useLimitStore.getState().bannerDetails).not.toBeNull();
      expect(useLimitStore.getState().bannerDetails?.subheader).toContain(
        'You have used 12 out of 10 of the User resource.'
      );
    });
  });

  describe('disabled limits config', () => {
    it('returns a sentinel sub-limit and never touches the banner when config.enable is false', async () => {
      useLimitStore.setState({ config: { ...ENABLED_CONFIG, enable: false } });
      // Pre-seed a banner to prove the disabled path does not clear it.
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
      expect(mockedGetLimitByResource).not.toHaveBeenCalled();
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
      mockedGetLimitByResource.mockResolvedValueOnce(
        buildLimitResponse({ currentCount: 9, softLimit: 7, hardLimit: 10 })
      );
      await useLimitStore.getState().getResourceLimit('user', true, true);

      expect(useLimitStore.getState().bannerDetails?.subheader).toContain(
        'You have used 9 out of 10'
      );

      // Non-force call: no new API call; cached count=9 still drives the banner.
      const result = await useLimitStore.getState().getResourceLimit('user');

      expect(mockedGetLimitByResource).toHaveBeenCalledTimes(1);
      expect(result.currentCount).toBe(9);
      expect(useLimitStore.getState().bannerDetails?.subheader).toContain(
        'You have used 9 out of 10'
      );
    });
  });
});
