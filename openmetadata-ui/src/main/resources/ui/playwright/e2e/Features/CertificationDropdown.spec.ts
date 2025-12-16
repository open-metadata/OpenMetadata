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
import { expect, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { TagClass } from '../../support/tag/TagClass';
import {
  closeCertificationDropdown,
  openCertificationDropdown,
  setAllSystemCertificationTagsDisabled,
  setCertificationClassificationDisabled,
  setTagDisabled,
  setTagDisabledByFqn,
  SYSTEM_CERTIFICATION_TAGS,
} from '../../utils/certification';
import { createNewPage, redirectToHomePage } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

test.describe.serial('Certification Dropdown', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await setCertificationClassificationDisabled(apiContext, false);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await setCertificationClassificationDisabled(apiContext, false);
    await table.delete(apiContext);
    await afterAction();
  });

  test('should show enabled certification tag in dropdown', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const tag = new TagClass({ classification: 'Certification' });
    await tag.create(apiContext);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${tag.responseData.fullyQualifiedName}`)
      ).toBeVisible();

      await closeCertificationDropdown(page);
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('should NOT show disabled certification tag in dropdown', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const enabledTag = new TagClass({ classification: 'Certification' });
    const disabledTag = new TagClass({ classification: 'Certification' });

    await enabledTag.create(apiContext);
    await disabledTag.create(apiContext);
    await setTagDisabled(apiContext, disabledTag.responseData.id, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      await expect(
        page.getByTestId(
          `radio-btn-${disabledTag.responseData.fullyQualifiedName}`
        )
      ).not.toBeVisible();

      await expect(
        page.getByTestId(
          `radio-btn-${enabledTag.responseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      await closeCertificationDropdown(page);
    } finally {
      await enabledTag.delete(apiContext);
      await disabledTag.delete(apiContext);
      await afterAction();
    }
  });

  test('should NOT show certifications when classification is disabled', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const tag = new TagClass({ classification: 'Certification' });
    await tag.create(apiContext);
    await setCertificationClassificationDisabled(apiContext, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${tag.responseData.fullyQualifiedName}`)
      ).not.toBeVisible();

      await closeCertificationDropdown(page);
    } finally {
      await setCertificationClassificationDisabled(apiContext, false);
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('should show certification after re-enabling disabled tag', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const tag = new TagClass({ classification: 'Certification' });
    await tag.create(apiContext);
    await setTagDisabled(apiContext, tag.responseData.id, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${tag.responseData.fullyQualifiedName}`)
      ).not.toBeVisible();

      await closeCertificationDropdown(page);

      await setTagDisabled(apiContext, tag.responseData.id, false);

      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${tag.responseData.fullyQualifiedName}`)
      ).toBeVisible();

      await closeCertificationDropdown(page);
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('should show certifications after re-enabling classification', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const tag = new TagClass({ classification: 'Certification' });
    await tag.create(apiContext);
    await setCertificationClassificationDisabled(apiContext, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${tag.responseData.fullyQualifiedName}`)
      ).not.toBeVisible();

      await closeCertificationDropdown(page);

      await setCertificationClassificationDisabled(apiContext, false);

      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${tag.responseData.fullyQualifiedName}`)
      ).toBeVisible();

      await closeCertificationDropdown(page);
    } finally {
      await setCertificationClassificationDisabled(apiContext, false);
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('should handle multiple disabled tags correctly', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const enabledTag = new TagClass({ classification: 'Certification' });
    const disabledTag1 = new TagClass({ classification: 'Certification' });
    const disabledTag2 = new TagClass({ classification: 'Certification' });

    await enabledTag.create(apiContext);
    await disabledTag1.create(apiContext);
    await disabledTag2.create(apiContext);
    await setTagDisabled(apiContext, disabledTag1.responseData.id, true);
    await setTagDisabled(apiContext, disabledTag2.responseData.id, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      await expect(
        page.getByTestId(
          `radio-btn-${disabledTag1.responseData.fullyQualifiedName}`
        )
      ).not.toBeVisible();

      await expect(
        page.getByTestId(
          `radio-btn-${disabledTag2.responseData.fullyQualifiedName}`
        )
      ).not.toBeVisible();

      await expect(
        page.getByTestId(
          `radio-btn-${enabledTag.responseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      await closeCertificationDropdown(page);
    } finally {
      await enabledTag.delete(apiContext);
      await disabledTag1.delete(apiContext);
      await disabledTag2.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe.serial('System Level Certification Tags', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await setCertificationClassificationDisabled(apiContext, false);
    await setAllSystemCertificationTagsDisabled(apiContext, false);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await setCertificationClassificationDisabled(apiContext, false);
    await setAllSystemCertificationTagsDisabled(apiContext, false);
    await table.delete(apiContext);
    await afterAction();
  });

  test('should NOT show disabled system certification tag in dropdown', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const disabledTagFqn = 'Certification.Gold';
    await setTagDisabledByFqn(apiContext, disabledTagFqn, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      // Disabled Gold tag should NOT be visible
      await expect(
        page.getByTestId(`radio-btn-${disabledTagFqn}`)
      ).not.toBeVisible();

      // Other system tags should still be visible
      await expect(
        page.getByTestId('radio-btn-Certification.Silver')
      ).toBeVisible();
      await expect(
        page.getByTestId('radio-btn-Certification.Bronze')
      ).toBeVisible();

      await closeCertificationDropdown(page);
    } finally {
      await setTagDisabledByFqn(apiContext, disabledTagFqn, false);
      await afterAction();
    }
  });

  test('should NOT show any system certification tags when classification is disabled', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await setCertificationClassificationDisabled(apiContext, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      // All system certification tags should NOT be visible
      for (const tagFqn of SYSTEM_CERTIFICATION_TAGS) {
        await expect(page.getByTestId(`radio-btn-${tagFqn}`)).not.toBeVisible();
      }

      await closeCertificationDropdown(page);
    } finally {
      await setCertificationClassificationDisabled(apiContext, false);
      await afterAction();
    }
  });
});
