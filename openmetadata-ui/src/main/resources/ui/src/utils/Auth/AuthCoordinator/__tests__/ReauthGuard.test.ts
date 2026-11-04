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

import { extractDetailsFromToken } from '../../../AuthProvider.util';
import { getOidcToken } from '../../../SwTokenStorageUtils';
import {
  decideReauth,
  hasReplacedToken,
  markReauthAttempt,
  REAUTH_COOLDOWN_MS,
  waitForSiblingToken,
} from '../ReauthGuard';

jest.mock('../../../SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn(),
}));

jest.mock('../../../AuthProvider.util', () => ({
  extractDetailsFromToken: jest.fn(),
}));

const mockedGetOidcToken = getOidcToken as jest.MockedFunction<
  typeof getOidcToken
>;
const mockedExtractDetailsFromToken =
  extractDetailsFromToken as jest.MockedFunction<
    typeof extractDetailsFromToken
  >;

const REAUTH_ATTEMPT_KEY = 'om-reauth';

// A record written by another tab: same localStorage, different tab id.
const recordSiblingAttempt = (startedAt: number) =>
  localStorage.setItem(
    REAUTH_ATTEMPT_KEY,
    JSON.stringify({ startedAt, tabId: 'sibling-tab' })
  );

// Tokens are opaque strings here; their expiry is whatever the test says.
const NOW_SECONDS = Math.floor(Date.now() / 1000);
const expiryByToken: Record<string, number> = {
  'current-token': NOW_SECONDS + 600,
  'newer-token': NOW_SECONDS + 3_600,
  // Token lifetimes can change between two tokens, so a replacement can
  // expire before the token it replaces.
  'shorter-lived-token': NOW_SECONDS + 300,
  'expired-token': NOW_SECONDS - 60,
};

const advanceTimers = (ms: number) =>
  (
    jest as unknown as {
      advanceTimersByTimeAsync: (ms: number) => Promise<void>;
    }
  ).advanceTimersByTimeAsync(ms);

describe('ReauthGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockedExtractDetailsFromToken.mockImplementation((token: string) => ({
      exp: expiryByToken[token] ?? 0,
      isExpired: false,
      timeoutExpiry: 0,
    }));
  });

  describe('decideReauth', () => {
    it('allows a re-authentication when no attempt is on record', () => {
      expect(decideReauth()).toBe('reauth');
    });

    it('signs out when this tab already redirected within the cooldown', () => {
      // The redirect happened, came back, and the refresh failed again: a
      // second redirect would loop.
      expect(markReauthAttempt()).toBe(true);

      expect(decideReauth()).toBe('logout');
    });

    it('waits for a sibling tab that is re-authenticating right now', () => {
      recordSiblingAttempt(Date.now());

      expect(decideReauth()).toBe('wait-for-sibling');
    });

    it('allows a new attempt once the recorded one is older than the cooldown', () => {
      const now = Date.now();
      markReauthAttempt(now - REAUTH_COOLDOWN_MS - 1);

      expect(decideReauth(now)).toBe('reauth');
    });

    it('ignores a record it cannot parse', () => {
      localStorage.setItem(REAUTH_ATTEMPT_KEY, '{not json');

      expect(decideReauth()).toBe('reauth');
    });

    it('keeps the tab identity across page loads through sessionStorage', () => {
      markReauthAttempt();
      const { tabId } = JSON.parse(
        localStorage.getItem(REAUTH_ATTEMPT_KEY) ?? '{}'
      );

      expect(sessionStorage.getItem('om-tab-id')).toBe(tabId);
    });
  });

  describe('markReauthAttempt', () => {
    it('reports failure when the attempt cannot be persisted', () => {
      const setItem = jest
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('QuotaExceededError');
        });
      try {
        expect(markReauthAttempt()).toBe(false);
      } finally {
        setItem.mockRestore();
      }
    });
  });

  describe('hasReplacedToken', () => {
    it('is false while storage still holds the token that failed', () => {
      expect(hasReplacedToken('current-token', 'current-token')).toBe(false);
    });

    it('is false when storage is empty', () => {
      expect(hasReplacedToken('', 'current-token')).toBe(false);
    });

    it('is true for a different token that has not expired', () => {
      expect(hasReplacedToken('newer-token', 'current-token')).toBe(true);
    });

    it('is true for a replacement that expires before the token it replaces', () => {
      expect(hasReplacedToken('shorter-lived-token', 'current-token')).toBe(
        true
      );
    });

    it('is false for a different token that has already expired', () => {
      expect(hasReplacedToken('expired-token', 'current-token')).toBe(false);
    });

    it('is true for a different token without an expiry', () => {
      expect(hasReplacedToken('opaque-token', 'current-token')).toBe(true);
    });
  });

  describe('waitForSiblingToken', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('resolves true straight away when the sibling already replaced the token', async () => {
      // A throttled tab handling its failure late finds the sibling's fresh
      // token in storage; waiting for a newer one would run out the cooldown
      // and sign the fresh session out.
      recordSiblingAttempt(Date.now());
      mockedGetOidcToken.mockResolvedValue('newer-token');

      await expect(waitForSiblingToken('current-token')).resolves.toBe(true);
      expect(mockedGetOidcToken).toHaveBeenCalledTimes(1);
    });

    it('resolves true once the sibling stores a replacement for the stale token', async () => {
      recordSiblingAttempt(Date.now());
      mockedGetOidcToken
        .mockResolvedValueOnce('current-token')
        .mockResolvedValueOnce('newer-token');

      const outcome = waitForSiblingToken('current-token');
      await advanceTimers(2_000);

      await expect(outcome).resolves.toBe(true);
      expect(mockedGetOidcToken).toHaveBeenCalledTimes(2);
    });

    it('resolves false as soon as the token is cleared (the sibling signed out)', async () => {
      recordSiblingAttempt(Date.now());
      mockedGetOidcToken.mockResolvedValueOnce('');

      const outcome = waitForSiblingToken('current-token');
      await advanceTimers(1_000);

      await expect(outcome).resolves.toBe(false);
    });

    it('keeps waiting past an expired token the sibling did not replace', async () => {
      recordSiblingAttempt(Date.now());
      mockedGetOidcToken.mockResolvedValue('expired-token');

      const outcome = waitForSiblingToken('current-token');
      await advanceTimers(REAUTH_COOLDOWN_MS + 1_000);

      await expect(outcome).resolves.toBe(false);
    });

    it('resolves false when the sibling cooldown runs out without a new token', async () => {
      recordSiblingAttempt(Date.now());
      mockedGetOidcToken.mockResolvedValue('current-token');

      const outcome = waitForSiblingToken('current-token');
      await advanceTimers(REAUTH_COOLDOWN_MS + 1_000);

      await expect(outcome).resolves.toBe(false);
    });
  });
});
