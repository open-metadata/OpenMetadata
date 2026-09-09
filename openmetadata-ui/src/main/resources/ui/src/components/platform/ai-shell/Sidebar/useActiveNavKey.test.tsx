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

import { renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppModule } from '../AppModule.types';

// Nav keys are module ids, and the module list is contributed at runtime, so
// the hook is exercised against a fixture registry.
const MODULES = [
  {
    id: 'observability',
    navOrder: 1,
    labelKey: 'label.observability',
    prefix: '/observability',
    routes: [],
  },
  {
    id: 'connections',
    navOrder: 2,
    labelKey: 'label.connection-plural',
    prefix: '/connections',
    routes: [],
  },
  {
    id: 'governance',
    navOrder: 3,
    labelKey: 'label.governance',
    prefix: '/governance',
    additionalPrefixes: ['/tags'],
    routes: [],
  },
] as unknown as AppModule[];

jest.mock('../sharedAppModules', () => ({
  useAllAppModules: () => MODULES,
}));

import { useActiveNavKey } from './useActiveNavKey';

const wrap =
  (initialPath: string) =>
  ({ children }: { children: React.ReactNode }) =>
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>;

const activeKeyAt = (path: string) =>
  renderHook(() => useActiveNavKey(), { wrapper: wrap(path) }).result.current;

describe('useActiveNavKey', () => {
  it('returns the module key for an exact prefix match', () => {
    expect(activeKeyAt('/connections')).toBe('connections');
  });

  it('returns the module key for a child route', () => {
    expect(activeKeyAt('/observability/data-quality')).toBe('observability');
  });

  it('returns the module key for an additional prefix', () => {
    expect(activeKeyAt('/tags')).toBe('governance');
  });

  it('returns undefined when no module owns the path', () => {
    expect(activeKeyAt('/some/unknown/route')).toBeUndefined();
  });

  it('returns undefined on the home route, which belongs to no module', () => {
    expect(activeKeyAt('/')).toBeUndefined();
  });

  it('does not match a sibling path that merely shares the prefix string', () => {
    expect(activeKeyAt('/connectionsx')).toBeUndefined();
  });
});
