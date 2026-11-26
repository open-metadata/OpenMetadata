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
import { APIRequestContext, expect } from '@playwright/test';
import { ACTION_TIMEOUT } from '../constant/common';

export const enableDisableSearchRBAC = async (
  apiContext: APIRequestContext,
  enable: boolean
) => {
  const settingResponse = await apiContext.get(
    '/api/v1/system/settings/searchSettings'
  );
  if (!settingResponse.ok()) {
    throw new Error(
      `Unable to read search settings: ${settingResponse.status()} ${await settingResponse.text()}`
    );
  }
  const initialSetting = await settingResponse.json();

  // Callers re-assert this per test, so skip the write and the poll on a no-op.
  if (
    initialSetting.config_value?.globalSettings?.enableAccessControl === enable
  ) {
    return;
  }

  const updatedSetting = {
    ...initialSetting,
    config_value: {
      ...initialSetting.config_value,
      globalSettings: {
        ...initialSetting.config_value.globalSettings,
        enableAccessControl: enable,
      },
    },
  };

  const updateResponse = await apiContext.put('/api/v1/system/settings', {
    data: updatedSetting,
  });
  if (!updateResponse.ok()) {
    throw new Error(
      `Unable to update search RBAC: ${updateResponse.status()} ${await updateResponse.text()}`
    );
  }

  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          '/api/v1/system/settings/searchSettings'
        );
        if (!response.ok()) {
          throw new Error(
            `HTTP ${response.status()} querying ${response.url()}`
          );
        }
        const settings = await response.json();

        return settings.config_value?.globalSettings?.enableAccessControl;
      },
      {
        message: `Search RBAC setting did not become ${String(enable)}`,
        timeout: ACTION_TIMEOUT,
      }
    )
    .toBe(enable);
};
