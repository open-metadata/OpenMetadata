/*
 *  Copyright 2025 Collate.
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
import { Page } from '@playwright/test';
import ServiceBaseClass from '../support/entity/ingestion/ServiceBaseClass';
import { waitForAutoPilotResult } from './autopilotExecution';
import { getApiContext } from './common';
import { getServiceCategoryFromService } from './serviceIngestion';

export const checkAutoPilotStatus = async (
  page: Page,
  service: ServiceBaseClass,
  startedAfter: number,
  timeoutMs: number
) => {
  const { apiContext } = await getApiContext(page);
  try {
    return await waitForAutoPilotResult(
      apiContext,
      `<#E::${getServiceCategoryFromService(
        service.category
      )}::${service.getServiceName()}>`,
      startedAfter,
      timeoutMs
    );
  } finally {
    await apiContext.dispose();
  }
};
