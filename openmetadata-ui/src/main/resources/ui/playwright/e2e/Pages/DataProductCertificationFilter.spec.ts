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
import test, { APIRequestContext, expect, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TagClass } from '../../support/tag/TagClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { clickUpdateButtonIfVisible } from '../../utils/explore';
import { waitForAggregation } from '../../utils/searchAggregation';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

type QuickFilter = {
  /** Rendered dropdown label, which is also part of its test id. */
  label: string;
  /** Aggregated field, which is also the URL parameter for the filter. */
  field: string;
};

const CERTIFICATION_FILTER: QuickFilter = {
  label: 'Certification',
  field: 'certification.tagLabel.tagFQN',
};
const GLOSSARY_FILTER: QuickFilter = {
  label: 'Glossary Terms',
  field: 'glossaryTags',
};
const TAG_FILTER: QuickFilter = {
  label: 'Tags',
  field: 'classificationTags',
};

const domain = new Domain();
const goldCertification = new TagClass({ classification: 'Certification' });
const silverCertification = new TagClass({ classification: 'Certification' });
const goldDataProduct = new DataProduct([domain]);
const silverDataProduct = new DataProduct([domain]);

// `glossaryTags` and `classificationTags` are indexed through
// `lowercase_normalizer`, so their aggregation buckets come back lowercased
// while `_source` keeps the original casing. Mixed-case names make the
// difference between the two observable.
const casingId = uuid();
const glossary = new Glossary(`PW Enterprise Business Glossary ${casingId}`);
const glossaryTerm = new GlossaryTerm(
  glossary,
  undefined,
  `PW Advanced Shipment Notification ${casingId}`
);
const classificationTag = new TagClass({
  classification: 'PersonalData',
  name: `PW Data Protection Classification ${casingId}`,
});

const certificationPatch = (tagFQN: string): Operation[] => [
  {
    op: 'add',
    path: '/certification',
    value: {
      tagLabel: {
        tagFQN,
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      },
    },
  },
];

const tagLabel = (tagFQN: string, source: string) => ({
  tagFQN,
  source,
  labelType: 'Manual',
  state: 'Confirmed',
});

const patchDataProduct = async (
  apiContext: APIRequestContext,
  dataProduct: DataProduct,
  data: Operation[]
) => {
  const response = await apiContext.patch(
    `/api/v1/dataProducts/${dataProduct.responseData.id}`,
    {
      data,
      headers: { 'Content-Type': 'application/json-patch+json' },
    }
  );

  expect(response.status()).toBe(200);
};

const assignCertification = (
  apiContext: APIRequestContext,
  dataProduct: DataProduct,
  certification: TagClass
) =>
  patchDataProduct(
    apiContext,
    dataProduct,
    certificationPatch(certification.responseData.fullyQualifiedName)
  );

/**
 * Types the value into the filter dropdown until the aggregation returns a
 * matching bucket, then returns that bucket key — which is also the option's
 * test id. The data product has to be indexed first, so this is retried rather
 * than asserted once.
 */
const resolveFilterOptionKey = async (
  page: Page,
  filter: QuickFilter,
  searchText: string
): Promise<string> => {
  const menu = page.getByTestId('drop-down-menu');
  let resolvedKey = '';

  await expect(async () => {
    const isMenuOpen = await menu.isVisible().catch(() => false);
    if (!isMenuOpen) {
      await page.getByTestId(`search-dropdown-${filter.label}`).click();
      await menu.waitFor({ state: 'visible' });
    }

    const aggregateResponse = waitForAggregation(page, {
      field: filter.field,
      value: searchText,
    });
    await menu.getByTestId('search-input').fill(searchText);
    const body = await (await aggregateResponse).json();
    const buckets: Array<{ key: string }> =
      body?.aggregations?.[`sterms#${filter.field}`]?.buckets ?? [];
    // Buckets are lowercased by the index normalizer, so the match has to be.
    const match = buckets.find((bucket) =>
      bucket.key.includes(searchText.toLowerCase())
    );

    if (!match) {
      throw new Error(
        `No ${
          filter.field
        } bucket matched "${searchText}". Server returned keys: ${JSON.stringify(
          buckets.map((bucket) => bucket.key)
        )}`
      );
    }

    resolvedKey = match.key;
    await menu.getByTestId(resolvedKey).waitFor({ state: 'visible' });
  }).toPass({ timeout: 90_000, intervals: [2_000, 5_000, 10_000] });

  return resolvedKey;
};

const applyFilter = async (page: Page, optionKey: string) => {
  const option = page.getByTestId('drop-down-menu').getByTestId(optionKey);

  const queryResponse = page.waitForResponse((response) => {
    if (!response.url().includes('/api/v1/search/query')) {
      return false;
    }
    const queryFilter =
      new URL(response.url()).searchParams.get('query_filter') ?? '';

    return queryFilter.includes(`"${optionKey}"`);
  });
  await option.click();
  await clickUpdateButtonIfVisible(page);
  await queryResponse;
  await waitForAllLoadersToDisappear(page);
};

const navigateToDataProducts = async (page: Page) => {
  await sidebarClick(page, SidebarItem.DATA_PRODUCT);
  await waitForAllLoadersToDisappear(page);
};

test.describe('Data Products - quick filters', { tag: '@Governance' }, () => {
  test.beforeAll('Setup data products', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await domain.create(apiContext);
    await goldCertification.create(apiContext);
    await silverCertification.create(apiContext);
    await goldDataProduct.create(apiContext);
    await silverDataProduct.create(apiContext);

    await assignCertification(apiContext, goldDataProduct, goldCertification);
    await assignCertification(
      apiContext,
      silverDataProduct,
      silverCertification
    );

    await afterAction();
  });

  test.afterAll('Cleanup data products', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await goldDataProduct.delete(apiContext);
    await silverDataProduct.delete(apiContext);
    await goldCertification.delete(apiContext);
    await silverCertification.delete(apiContext);
    await domain.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.describe('Certification filter', () => {
    test('lists only certifications assigned to data products', async ({
      page,
    }) => {
      await test.step('Navigate to the Data Products page', async () => {
        await navigateToDataProducts(page);
      });

      await test.step('Certification quick filter is available', async () => {
        await expect(
          page.getByTestId(`search-dropdown-${CERTIFICATION_FILTER.label}`)
        ).toBeVisible();
      });

      await test.step('Assigned certifications are searchable', async () => {
        await resolveFilterOptionKey(
          page,
          CERTIFICATION_FILTER,
          goldCertification.responseData.name
        );
        await resolveFilterOptionKey(
          page,
          CERTIFICATION_FILTER,
          silverCertification.responseData.name
        );
        await page.keyboard.press('Escape');
      });
    });

    test('filtering by a certification narrows the listing', async ({
      page,
    }) => {
      await test.step('Navigate to the Data Products page', async () => {
        await navigateToDataProducts(page);
      });

      await test.step('Apply the gold certification filter', async () => {
        const goldOptionKey = await resolveFilterOptionKey(
          page,
          CERTIFICATION_FILTER,
          goldCertification.responseData.name
        );
        await applyFilter(page, goldOptionKey);
      });

      await test.step('Only the gold-certified data product remains', async () => {
        await expect(
          page.getByText(goldDataProduct.responseData.displayName)
        ).toBeVisible();
        await expect(
          page.getByText(silverDataProduct.responseData.displayName)
        ).toBeHidden();
      });
    });
  });

  test.describe('Option casing', () => {
    test.beforeAll('Tag a data product', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await classificationTag.create(apiContext);

      await patchDataProduct(apiContext, goldDataProduct, [
        {
          op: 'add',
          path: '/tags',
          value: [
            tagLabel(glossaryTerm.responseData.fullyQualifiedName, 'Glossary'),
            tagLabel(
              classificationTag.responseData.fullyQualifiedName,
              'Classification'
            ),
          ],
        },
      ]);

      await afterAction();
    });

    test.afterAll('Cleanup tags', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await classificationTag.delete(apiContext);

      await afterAction();
    });

    test('glossary term option keeps its original casing while the filter value stays lowercased', async ({
      page,
    }) => {
      test.slow();

      const termFQN = glossaryTerm.responseData.fullyQualifiedName;

      await navigateToDataProducts(page);

      const optionKey =
        await test.step('The dropdown option reads in the original casing', async () => {
          const resolvedKey = await resolveFilterOptionKey(
            page,
            GLOSSARY_FILTER,
            glossaryTerm.responseData.name
          );

          // The option is keyed by the lowercased bucket key — what the
          // `top_hits` sub-aggregation adds is the label read from `_source`.
          expect(resolvedKey).toBe(termFQN.toLowerCase());
          await expect(
            page.getByTestId('drop-down-menu').getByTestId(resolvedKey)
          ).toContainText(termFQN);

          return resolvedKey;
        });

      await test.step('Applying the filter keeps the original casing on the chip', async () => {
        await applyFilter(page, optionKey);

        await expect(
          page.getByTestId(`filter-chip-${GLOSSARY_FILTER.field}`)
        ).toContainText(termFQN);
        await expect(
          page.getByText(goldDataProduct.responseData.displayName)
        ).toBeVisible();
      });

      await test.step('The URL carries the lowercased key, not the label', async () => {
        expect(
          new URL(page.url()).searchParams.get(GLOSSARY_FILTER.field)
        ).toBe(optionKey);
      });

      await test.step('The casing survives a reload of the filtered URL', async () => {
        await page.reload();
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId(`filter-chip-${GLOSSARY_FILTER.field}`)
        ).toContainText(termFQN);
      });
    });

    test('tag option keeps its original casing', async ({ page }) => {
      const tagFQN = classificationTag.responseData.fullyQualifiedName;

      await navigateToDataProducts(page);

      const optionKey = await resolveFilterOptionKey(
        page,
        TAG_FILTER,
        classificationTag.responseData.name
      );

      expect(optionKey).toBe(tagFQN.toLowerCase());
      await expect(
        page.getByTestId('drop-down-menu').getByTestId(optionKey)
      ).toContainText(tagFQN);

      await applyFilter(page, optionKey);

      await expect(
        page.getByTestId(`filter-chip-${TAG_FILTER.field}`)
      ).toContainText(tagFQN);
    });
  });
});
