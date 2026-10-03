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

import type { SettingsHashState } from '../../../../hooks/useSettingsHash';

export interface ProfileTarget {
  /** The user whose profile to show — the hashed user, else the current user. */
  targetUsername?: string;
  /** True when the hashed user differs from the logged-in user. */
  isViewingOtherUser: boolean;
}

/**
 * The `profile` tab may deep-link to another user via its sub-path
 * (`#profile/<username>`); fall back to the current user when absent. Mirrors
 * the legacy UserPage reading the username from the URL.
 */
export const resolveProfileTarget = (
  state: Pick<SettingsHashState, 'tab' | 'subPath'>,
  currentUserName?: string
): ProfileTarget => {
  const targetUsername =
    state.tab === 'profile' && state.subPath
      ? decodeURIComponent(state.subPath)
      : currentUserName;

  return {
    targetUsername,
    isViewingOtherUser: Boolean(
      targetUsername && currentUserName && targetUsername !== currentUserName
    ),
  };
};
