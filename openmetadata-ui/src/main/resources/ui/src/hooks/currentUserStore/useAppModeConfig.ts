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

import { create } from 'zustand';
import {
  AI_APP_MODE,
  DEFAULT_APP_MODE,
} from '../../constants/appMode.constants';
import {
  AppConfiguration,
  DefaultAppMode,
} from '../../generated/api/configuration/appConfiguration';
import { writeAppMode } from '../useAppMode';

interface AppModeConfigStore {
  isForced: boolean;
  forcedMode: string | null;
  setForced: (mode: string | null) => void;
}

export const useAppModeConfig = create<AppModeConfigStore>((set) => ({
  isForced: false,
  forcedMode: null,
  setForced: (mode) => set({ isForced: mode != null, forcedMode: mode }),
}));

/**
 * Translate the yaml/env-facing `defaultAppMode` wire value into the
 * runtime mode string consumed by `useAppMode`. Mirrors
 * `APP_MODE_ENUM_TO_RUNTIME` in `useResolvedAppMode.ts`: core has always
 * used the string `DEFAULT_APP_MODE` ("default") for Classic, while the
 * Collate plugin registers its routes under `AI_APP_MODE` ("ai"). The
 * yaml value stays the readable "ai" / "classic" pair for operators; this
 * map is the only place that needs to know the runtime strings differ.
 */
const CONFIG_MODE_TO_RUNTIME: Record<string, string> = {
  [DefaultAppMode.Classic]: DEFAULT_APP_MODE,
  [DefaultAppMode.Ai]: AI_APP_MODE,
};

/**
 * Hydrate the tenant-level app-mode force from the boot-time
 * `GET /system/config/appConfig` response.
 *
 * Order matters: the runtime pin (`writeAppMode`) is written BEFORE
 * `setForced` flips `isForced` to true. `writeAppMode` has its own guard
 * that no-ops once a force is active (see `useAppMode.ts`) — writing
 * first means this initial pin lands while the store still looks
 * unforced, and every write after this one is correctly blocked.
 */
export const hydrateAppModeConfig = (config: AppConfiguration): void => {
  const wireMode = config?.defaultAppMode ?? null;
  const runtimeMode = wireMode ? CONFIG_MODE_TO_RUNTIME[wireMode] : null;

  if (runtimeMode) {
    writeAppMode(runtimeMode);
  }
  useAppModeConfig.getState().setForced(wireMode);
};
