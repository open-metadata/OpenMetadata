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
import { AppPlugin } from '../../Settings/Applications/plugins/AppPlugin';
import { AppModule } from './AppModule.types';
import { sharedAppModules, useAllAppModules } from './sharedAppModules';

const mockUseApplicationsProvider = jest.fn();

jest.mock(
  '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => mockUseApplicationsProvider(),
  })
);

const buildModule = (id: string, navOrder: number): AppModule => ({
  id,
  navOrder,
  labelKey: `label.${id}`,
  prefix: `/${id}`,
  defaultPath: `/${id}`,
  routes: [],
});

const buildPlugin = (
  name: string,
  getModeModules?: AppPlugin['getModeModules']
): AppPlugin => ({
  name,
  isInstalled: true,
  getModeModules,
});

describe('sharedAppModules', () => {
  beforeEach(() => {
    mockUseApplicationsProvider.mockReset();
  });

  it('merges shared modules with plugin classicV1 modules, sorted by navOrder', () => {
    const pluginModule = buildModule('x', 5);
    const plugin = buildPlugin('contributingPlugin', (mode: string) =>
      mode === 'classicV1' ? [pluginModule] : []
    );
    mockUseApplicationsProvider.mockReturnValue({ plugins: [plugin] });

    const { result } = renderHook(() => useAllAppModules());

    const ids = result.current.map((m) => m.id);

    expect(ids).toContain('x');

    const expectedOrder = [...sharedAppModules, pluginModule]
      .map((module, index) => ({ module, index }))
      .sort((a, b) =>
        a.module.navOrder === b.module.navOrder
          ? a.index - b.index
          : a.module.navOrder - b.module.navOrder
      )
      .map(({ module }) => module.id);

    expect(ids).toEqual(expectedOrder);
  });

  it('does not contribute modules for a plugin without getModeModules', () => {
    const plugin = buildPlugin('noOpPlugin');
    mockUseApplicationsProvider.mockReturnValue({ plugins: [plugin] });

    const { result } = renderHook(() => useAllAppModules());

    expect(result.current.map((m) => m.id)).toEqual(
      sharedAppModules.map((m) => m.id)
    );
  });

  it('ignores modules a plugin contributes to a different mode', () => {
    const otherModeModule = buildModule('other-mode-only', 1);
    const plugin = buildPlugin('otherModePlugin', (mode: string) =>
      mode === 'someOtherMode' ? [otherModeModule] : []
    );
    mockUseApplicationsProvider.mockReturnValue({ plugins: [plugin] });

    const { result } = renderHook(() => useAllAppModules());

    expect(result.current.map((m) => m.id)).not.toContain('other-mode-only');
  });
});
