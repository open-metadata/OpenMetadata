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
import { Page, Route } from '@playwright/test';

export interface MockSettingSource {
  configType: string;
  source: 'AUTO' | 'ENV' | 'DB';
  sourceVariable?: string;
  editable: boolean;
  managedPaths?: string[];
  overriddenFields?: { path: string; envVariable?: string }[];
}

export interface AdoptRequest {
  configType: string;
  paths?: string[];
}

const SETTINGS_SOURCE_URL = '**/api/v1/system/settings/source';
const ADOPT_URL = '**/api/v1/system/settings/source/*/adopt';

// A request still in flight when the test ends must not fail it.
const fulfillUnlessClosed = async (route: Route, json: unknown) => {
  try {
    await route.fulfill({ json });
  } catch (error) {
    if (!/has been closed|Route is already handled/.test(String(error))) {
      throw error;
    }
  }
};

/**
 * Serves where settings take their values from, so a spec can put a setting in ENV or AUTO mode
 * without restarting the server. "Use deployment value" is recorded instead of sent; the
 * adopted setting then reports no overridden fields, as the server would. Install before
 * navigating to the page.
 */
export const mockSettingsSource = async (
  page: Page,
  settings: MockSettingSource[]
): Promise<AdoptRequest[]> => {
  let current = settings;
  const adoptRequests: AdoptRequest[] = [];

  await page.route(SETTINGS_SOURCE_URL, (route) =>
    fulfillUnlessClosed(route, { settings: current })
  );
  await page.route(ADOPT_URL, (route) => {
    const [configType] = new URL(route.request().url()).pathname
      .split('/')
      .slice(-2, -1);
    adoptRequests.push({
      configType,
      ...(route.request().postDataJSON() ?? {}),
    });
    current = current.map((setting) =>
      setting.configType === configType
        ? { ...setting, overriddenFields: [] }
        : setting
    );

    return fulfillUnlessClosed(
      route,
      current.find((setting) => setting.configType === configType)
    );
  });

  return adoptRequests;
};
