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

import { AuthProvider } from '../../../../../../generated/settings/settings';
import type { SsoView } from './SsoPanel.types';

export const SSO_HASH_TAB = 'sso';

const NEW_PREFIX = 'new/';

const isConfigurableProvider = (value: string): value is AuthProvider =>
  value !== AuthProvider.Basic &&
  (Object.values(AuthProvider) as string[]).includes(value);

/**
 * Without a saved SSO provider there is nothing to show on the overview or
 * configure tabs, so both fall back to the provider grid.
 */
export const hashSubPathToView = (
  subPath: string,
  hasExistingConfig: boolean
): SsoView => {
  if (subPath.startsWith(NEW_PREFIX)) {
    const provider = subPath.slice(NEW_PREFIX.length);

    return isConfigurableProvider(provider)
      ? { type: 'new', provider }
      : { type: 'providers' };
  }

  if (subPath === 'providers' || !hasExistingConfig) {
    return { type: 'providers' };
  }

  return subPath === 'configure' ? { type: 'configure' } : { type: 'overview' };
};

export const viewToSubPath = (view: SsoView): string | undefined => {
  switch (view.type) {
    case 'overview':
      return undefined;
    case 'new':
      return `${NEW_PREFIX}${view.provider}`;
    default:
      return view.type;
  }
};
