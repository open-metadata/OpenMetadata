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
import { test as teardown } from '@playwright/test';
import { deleteFixtureEntity } from '../utils/apiResponse';
import { getDefaultAdminAPIContext } from '../utils/common';
import { VISUAL_GLOSSARY_NAME } from '../utils/visualRegression';

teardown('remove visual regression data', async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);

  try {
    await deleteFixtureEntity(
      apiContext,
      `/api/v1/glossaries/name/${VISUAL_GLOSSARY_NAME}?recursive=true&hardDelete=true`
    );
  } finally {
    await afterAction();
  }
});
