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
import { test as setup } from '@playwright/test';
import { performAdminLogin } from '../utils/admin';
import { enableDisableSearchRBAC } from '../utils/searchRBAC';

setup('enable search RBAC', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  try {
    await enableDisableSearchRBAC(apiContext, true);
  } finally {
    await afterAction();
  }
});
