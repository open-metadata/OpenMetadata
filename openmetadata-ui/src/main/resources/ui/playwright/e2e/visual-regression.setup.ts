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
import { expect, test as setup } from '@playwright/test';
import { Glossary } from '../support/glossary/Glossary';
import { GlossaryTerm } from '../support/glossary/GlossaryTerm';
import { deleteFixtureEntity } from '../utils/apiResponse';
import { getDefaultAdminAPIContext } from '../utils/common';
import {
  VISUAL_GLOSSARY_DISPLAY_NAME,
  VISUAL_GLOSSARY_NAME,
  VISUAL_GLOSSARY_TERM_NAME,
} from '../utils/visualRegression';

setup('create stable visual regression data', async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);

  try {
    // An interrupted run can leave this fixed-name screenshot fixture behind.
    await deleteFixtureEntity(
      apiContext,
      `/api/v1/glossaries/name/${VISUAL_GLOSSARY_NAME}?recursive=true&hardDelete=true`
    );
    // Project dependencies keep this immutable fixture alive across workers
    // and repetitions until every visual assertion has completed.
    const glossary = new Glossary(VISUAL_GLOSSARY_NAME);
    glossary.data.displayName = VISUAL_GLOSSARY_DISPLAY_NAME;
    const created = await glossary.create(apiContext);
    expect(created.name).toBe(VISUAL_GLOSSARY_NAME);
    expect(created.displayName).toBe(VISUAL_GLOSSARY_DISPLAY_NAME);
    const term = new GlossaryTerm(
      glossary,
      undefined,
      VISUAL_GLOSSARY_TERM_NAME
    );
    await term.create(apiContext);
    expect(term.responseData.name).toBe(VISUAL_GLOSSARY_TERM_NAME);
  } finally {
    await afterAction();
  }
});
