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

import { extractDetailsFromToken } from '../../AuthProvider.util';
import { getOidcToken } from '../../SwTokenStorageUtils';

// Bounds silent re-authentication to one top-level redirect per tab per
// cooldown, and to one tab at a time. The attempt record lives in
// localStorage so sibling tabs see it; the tab id lives in sessionStorage,
// which survives the round trip through the identity provider, so a tab
// whose redirect came back and failed again recognises its own attempt and
// signs out instead of redirecting forever.
const REAUTH_ATTEMPT_KEY = 'om-reauth';
const TAB_ID_KEY = 'om-tab-id';
const SIBLING_POLL_INTERVAL_MS = 1_000;

export const REAUTH_COOLDOWN_MS = 3 * 60 * 1000;

export type ReauthDecision = 'reauth' | 'logout' | 'wait-for-sibling';

type ReauthAttempt = { startedAt: number; tabId: string };

const getTabId = (): string | null => {
  try {
    let tabId = sessionStorage.getItem(TAB_ID_KEY);
    if (!tabId) {
      tabId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}`;
      sessionStorage.setItem(TAB_ID_KEY, tabId);
    }

    return tabId;
  } catch {
    return null;
  }
};

const readAttempt = (): ReauthAttempt | null => {
  try {
    const raw = localStorage.getItem(REAUTH_ATTEMPT_KEY);
    const attempt = raw ? (JSON.parse(raw) as Partial<ReauthAttempt>) : null;
    const isValid =
      typeof attempt?.startedAt === 'number' &&
      typeof attempt.tabId === 'string';

    return isValid ? (attempt as ReauthAttempt) : null;
  } catch {
    return null;
  }
};

const readRecentAttempt = (now: number): ReauthAttempt | null => {
  const attempt = readAttempt();

  return attempt && now - attempt.startedAt < REAUTH_COOLDOWN_MS
    ? attempt
    : null;
};

export const decideReauth = (now = Date.now()): ReauthDecision => {
  const attempt = readRecentAttempt(now);
  if (!attempt) {
    return 'reauth';
  }

  return attempt.tabId === getTabId() ? 'logout' : 'wait-for-sibling';
};

/**
 * Records that this tab is about to redirect to the identity provider.
 * Returns false when the record cannot be persisted: without it nothing
 * would stop a redirect that keeps failing from looping, so the caller must
 * sign out instead.
 */
export const markReauthAttempt = (now = Date.now()): boolean => {
  const tabId = getTabId();
  if (!tabId) {
    return false;
  }
  try {
    const attempt: ReauthAttempt = { startedAt: now, tabId };
    localStorage.setItem(REAUTH_ATTEMPT_KEY, JSON.stringify(attempt));

    return true;
  } catch {
    return false;
  }
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * True when storage already holds a replacement for the token whose refresh
 * failed: a different token that has not expired. Storage only moves forward
 * (a later write is a newer token), so a different token is a newer one. Its
 * exp can still be earlier than the stale token's: token lifetimes can
 * change between the two (a lowered token validity, a provider policy).
 */
export const hasReplacedToken = (
  storedToken: string,
  staleToken: string
): boolean => {
  if (!storedToken || storedToken === staleToken) {
    return false;
  }
  const { exp } = extractDetailsFromToken(storedToken);

  return typeof exp !== 'number' || exp <= 0 || exp * 1000 > Date.now();
};

/**
 * Waits for the sibling tab that is re-authenticating to replace
 * `staleToken`. Resolves true once storage holds a replacement, which a tab
 * that handles its failure late can find there straight away; false when the
 * token is cleared (the sibling's attempt failed and it signed out) or the
 * sibling's cooldown runs out.
 */
export const waitForSiblingToken = async (
  staleToken: string
): Promise<boolean> => {
  const deadline =
    (readAttempt()?.startedAt ?? Date.now()) + REAUTH_COOLDOWN_MS;
  let outcome: boolean | null = null;
  while (outcome === null) {
    const storedToken = await getOidcToken().catch(() => '');
    if (!storedToken) {
      outcome = false;
    } else if (hasReplacedToken(storedToken, staleToken)) {
      outcome = true;
    } else if (Date.now() >= deadline) {
      outcome = false;
    } else {
      await delay(SIBLING_POLL_INTERVAL_MS);
    }
  }

  return outcome;
};
