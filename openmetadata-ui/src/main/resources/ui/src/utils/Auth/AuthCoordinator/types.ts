/*
 *  Copyright 2022 Collate.
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

export type RenewResult = { idToken: string; expiresAt: number };

export type Renewer = () => Promise<RenewResult>;

export type AuthCoordinatorEvent = 'refreshed' | 'refresh-failed';

export type RefreshedPayload = { idToken: string; expiresAt: number };

// Which coordinator path gave up: this tab's own renewer threw (`error` is
// what it threw), a follower exhausted its retries after the leader failed,
// or the refresh-loop circuit-breaker tripped.
export type RefreshFailureSource = 'renewer' | 'follower' | 'circuit-breaker';

export type RefreshFailedPayload = {
  reason: string;
  error?: unknown;
  source: RefreshFailureSource;
  // The token the failed refresh was meant to replace: the bearer of the 401
  // that started it, or the stored token found expired. By the time a
  // (possibly throttled) tab handles the failure, storage can already hold a
  // sibling tab's replacement, so storage is no stand-in for it.
  staleToken?: string;
};

export type EventPayloadMap = {
  refreshed: RefreshedPayload;
  'refresh-failed': RefreshFailedPayload;
};

export type Unsubscribe = () => void;
