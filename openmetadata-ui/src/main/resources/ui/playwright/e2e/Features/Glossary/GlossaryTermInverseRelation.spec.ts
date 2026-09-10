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
import { expect, test } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { getDefaultAdminAPIContext } from '../../../utils/common';
import { addTermRelation } from '../../../utils/ontologyStudio';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

test.use({ storageState: 'playwright/.auth/admin.json' });

const glossary = new Glossary();
const termFrom = new GlossaryTerm(glossary);
const termTo = new GlossaryTerm(glossary);
const termParent = new GlossaryTerm(glossary);
const termChild = new GlossaryTerm(glossary);

test.beforeAll(
  'Seed glossary terms with inverse relations',
  async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    await glossary.create(apiContext);
    await termFrom.create(apiContext);
    await termTo.create(apiContext);
    await termParent.create(apiContext);
    await termChild.create(apiContext);

    await addTermRelation(apiContext, termFrom, termTo, 'narrower');
    await addTermRelation(apiContext, termParent, termChild, 'hasPart');

    await afterAction();
  }
);

test.afterAll('Clean up glossary data', async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);

  await termFrom.delete(apiContext);
  await termTo.delete(apiContext);
  await termParent.delete(apiContext);
  await termChild.delete(apiContext);
  await glossary.delete(apiContext);

  await afterAction();
});

test.describe('Glossary Term — Inverse Relation Display (#29687)', () => {
  test('source term shows the authored relation type', async ({ page }) => {
    await termFrom.visitEntityPage(page);

    const termToName =
      termTo.responseData?.displayName ?? termTo.data.displayName;

    await expect(page.getByTestId(termToName)).toBeVisible();
    await expect(
      page
        .getByTestId('related-term-container')
        .getByText('Narrower', { exact: true })
    ).toBeVisible();
  });

  test('target term shows the inverse relation type', async ({ page }) => {
    await termTo.visitEntityPage(page);

    const termFromName =
      termFrom.responseData?.displayName ?? termFrom.data.displayName;

    await expect(page.getByTestId(termFromName)).toBeVisible();
    await expect(
      page
        .getByTestId('related-term-container')
        .getByText('Broader', { exact: true })
    ).toBeVisible();
  });

  test('inverse relation type persists after page reload', async ({ page }) => {
    await termTo.visitEntityPage(page);

    const termFromName =
      termFrom.responseData?.displayName ?? termFrom.data.displayName;

    await expect(
      page
        .getByTestId('related-term-container')
        .getByText('Broader', { exact: true })
    ).toBeVisible();

    const reloadRes = waitForResponseWithStatus(
      page,
      (res) =>
        res.request().method() === 'GET' &&
        res.url().includes('/api/v1/glossaryTerms/name/'),
      200
    );
    await page.reload();
    await reloadRes;

    await expect(page.getByTestId(termFromName)).toBeVisible();
    await expect(
      page
        .getByTestId('related-term-container')
        .getByText('Broader', { exact: true })
    ).toBeVisible();
  });

  test('hasPart and partOf show on opposite sides of the relation', async ({
    page,
  }) => {
    await termParent.visitEntityPage(page);

    const termChildName =
      termChild.responseData?.displayName ?? termChild.data.displayName;

    await expect(page.getByTestId(termChildName)).toBeVisible();
    await expect(
      page
        .getByTestId('related-term-container')
        .getByText('Has Part', { exact: true })
    ).toBeVisible();

    await termChild.visitEntityPage(page);

    const termParentName =
      termParent.responseData?.displayName ?? termParent.data.displayName;

    await expect(page.getByTestId(termParentName)).toBeVisible();
    await expect(
      page
        .getByTestId('related-term-container')
        .getByText('Part Of', { exact: true })
    ).toBeVisible();
    await expect(
      page
        .getByTestId('related-term-container')
        .getByText('Has Part', { exact: true })
    ).not.toBeVisible();
  });
});
