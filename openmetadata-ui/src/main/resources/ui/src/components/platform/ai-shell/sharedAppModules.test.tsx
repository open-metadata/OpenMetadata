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
import leftSidebarClassBase from '../../../utils/LeftSidebarClassBase';
import { AppModule } from './AppModule.types';
import { useAllAppModules } from './sharedAppModules';

const buildModule = (id: string, navOrder: number): AppModule => ({
  id,
  navOrder,
  labelKey: `label.${id}`,
  prefix: `/${id}`,
  defaultPath: `/${id}`,
  routes: [],
});

describe('useAllAppModules', () => {
  const originalModules = leftSidebarClassBase.getAppModeModules();

  afterEach(() => {
    leftSidebarClassBase.setAppModeModules(originalModules);
  });

  it('returns the LeftSidebarClassBase app-mode modules sorted by navOrder', () => {
    const modules = [
      buildModule('c', 30),
      buildModule('a', 10),
      buildModule('b', 20),
    ];
    leftSidebarClassBase.setAppModeModules(modules);

    const { result } = renderHook(() => useAllAppModules());

    expect(result.current.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps insertion order for modules sharing a navOrder', () => {
    const modules = [
      buildModule('first', 10),
      buildModule('second', 10),
      buildModule('third', 5),
    ];
    leftSidebarClassBase.setAppModeModules(modules);

    const { result } = renderHook(() => useAllAppModules());

    expect(result.current.map((m) => m.id)).toEqual([
      'third',
      'first',
      'second',
    ]);
  });

  it('reflects a downstream override of getAppModeModules', () => {
    leftSidebarClassBase.setAppModeModules([
      ...originalModules,
      buildModule('collate-only', 999),
    ]);

    const { result } = renderHook(() => useAllAppModules());

    expect(result.current.map((m) => m.id)).toContain('collate-only');
  });
});
