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

import { writeAppMode } from '../useAppMode';
import { hydrateAppModeConfig, useAppModeConfig } from './useAppModeConfig';

jest.mock('../useAppMode', () => ({
  writeAppMode: jest.fn(),
  useAppMode: () => 'classic',
}));

beforeEach(() => {
  useAppModeConfig.getState().setForced(null);
  (writeAppMode as jest.Mock).mockClear();
});

describe('useAppModeConfig', () => {
  it('setForced with a value sets isForced true and forcedMode', () => {
    useAppModeConfig.getState().setForced('ai');

    expect(useAppModeConfig.getState().isForced).toBe(true);
    expect(useAppModeConfig.getState().forcedMode).toBe('ai');
  });

  it('setForced(null) clears the force', () => {
    useAppModeConfig.getState().setForced('ai');
    useAppModeConfig.getState().setForced(null);

    expect(useAppModeConfig.getState().isForced).toBe(false);
    expect(useAppModeConfig.getState().forcedMode).toBeNull();
  });
});

describe('hydrateAppModeConfig', () => {
  it('with a value forces and pins runtime mode', () => {
    hydrateAppModeConfig({ defaultAppMode: 'ai' });

    expect(useAppModeConfig.getState().isForced).toBe(true);
    expect(writeAppMode).toHaveBeenCalledWith('ai');
  });

  it('null clears force and does not pin runtime', () => {
    hydrateAppModeConfig({ defaultAppMode: null });

    expect(useAppModeConfig.getState().isForced).toBe(false);
    expect(writeAppMode).not.toHaveBeenCalled();
  });

  it('maps the "classic" wire value to the DEFAULT_APP_MODE runtime string', () => {
    // Core's runtime mode string for Classic is "default", not "classic" —
    // see APP_MODE_ENUM_TO_RUNTIME in useResolvedAppMode.ts. The tenant
    // force must go through the same translation or writeAppMode('classic')
    // would set a runtime mode nothing else recognizes.
    hydrateAppModeConfig({ defaultAppMode: 'classic' });

    expect(useAppModeConfig.getState().isForced).toBe(true);
    expect(writeAppMode).toHaveBeenCalledWith('default');
  });

  it('re-pins the runtime mode on a same-tab re-hydration when isForced is stale', () => {
    // Regression: the store is module-level and survives an SPA logout→login
    // without a page reload. If a prior session left `isForced=true`,
    // writeAppMode's own guard would no-op the re-hydration's initial pin
    // and the new session would be stuck on the previous runtime mode.
    // hydrateAppModeConfig must reset the force BEFORE the pin so the write
    // always lands.
    useAppModeConfig.getState().setForced('ai'); // stale from prior session

    hydrateAppModeConfig({ defaultAppMode: 'ai' });

    expect(writeAppMode).toHaveBeenCalledWith('ai');
    expect(useAppModeConfig.getState().isForced).toBe(true);
  });
});
