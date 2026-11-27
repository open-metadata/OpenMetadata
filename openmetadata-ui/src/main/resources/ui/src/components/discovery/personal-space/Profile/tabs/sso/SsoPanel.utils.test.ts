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
import { hashSubPathToView, viewToSubPath } from './SsoPanel.utils';

describe('hashSubPathToView', () => {
  it('opens the overview tab of a saved configuration by default', () => {
    expect(hashSubPathToView('', true)).toEqual({ type: 'overview' });
  });

  it('opens the configure tab of a saved configuration', () => {
    expect(hashSubPathToView('configure', true)).toEqual({
      type: 'configure',
    });
  });

  it('falls back to the provider grid while nothing is configured', () => {
    expect(hashSubPathToView('', false)).toEqual({ type: 'providers' });
    expect(hashSubPathToView('configure', false)).toEqual({
      type: 'providers',
    });
  });

  it('shows the provider grid on request even with a saved configuration', () => {
    expect(hashSubPathToView('providers', true)).toEqual({
      type: 'providers',
    });
  });

  it('opens the setup form for a provider being configured', () => {
    expect(hashSubPathToView('new/okta', false)).toEqual({
      type: 'new',
      provider: AuthProvider.Okta,
    });
  });

  it('rejects basic or unknown providers in the setup path', () => {
    expect(hashSubPathToView('new/basic', true)).toEqual({
      type: 'providers',
    });
    expect(hashSubPathToView('new/not-a-provider', true)).toEqual({
      type: 'providers',
    });
  });
});

describe('viewToSubPath', () => {
  it('round-trips every view through the hash', () => {
    const views = [
      { type: 'configure' },
      { type: 'providers' },
      { type: 'new', provider: AuthProvider.Saml },
    ] as const;

    views.forEach((view) => {
      expect(hashSubPathToView(viewToSubPath(view) ?? '', true)).toEqual(view);
    });
  });

  it('keeps the overview at the bare tab', () => {
    expect(viewToSubPath({ type: 'overview' })).toBeUndefined();
  });
});
