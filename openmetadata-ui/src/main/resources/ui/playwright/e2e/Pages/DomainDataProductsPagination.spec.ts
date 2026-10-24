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
import { Request, Response } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { expect, test } from '../../support/fixtures/userPages';
import { performAdminLogin } from '../../utils/admin';
import { clickIgnoringToasts, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForSearchIndexed } from '../../utils/polling';

let source: Domain;
let destination: Domain;
let products: DataProduct[] = [];
let prefix: string;

const isProductPage = (request: Request, domain: Domain, from?: number) => {
  const url = new URL(request.url());

  return (
    request.method() === 'GET' &&
    url.pathname.endsWith('/search/query') &&
    url.searchParams.get('index') === 'dataProduct' &&
    url.searchParams.get('size') === '25' &&
    (url.searchParams.get('query_filter') ?? '').includes(
      domain.responseData.fullyQualifiedName ?? domain.data.name
    ) &&
    (from === undefined || url.searchParams.get('from') === String(from))
  );
};

const productResponse =
  (domain: Domain, from: number) => (response: Response) =>
    isProductPage(response.request(), domain, from);

test.describe(
  'Domain data product pagination',
  { tag: ['@Pages', DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test.beforeAll(async ({ browser }) => {
      test.setTimeout(180_000);
      prefix = `pagination_${uuid()}`;
      source = new Domain({
        name: `${prefix}_a`,
        displayName: `${prefix} A`,
        description: 'Pagination source',
        domainType: 'Aggregate',
      });
      destination = new Domain({
        name: `${prefix}_b`,
        displayName: `${prefix} B`,
        description: 'Pagination destination',
        domainType: 'Aggregate',
      });
      products = Array.from(
        { length: 51 },
        (_, index) =>
          new DataProduct(
            [source],
            `${prefix}_product_${String(index).padStart(2, '0')}`
          )
      );
      products.push(
        new DataProduct([destination], `${prefix}_destination_product`)
      );
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await Promise.all([
          source.create(apiContext),
          destination.create(apiContext),
        ]);
        await Promise.all(
          products.map((product) => product.create(apiContext))
        );
        await Promise.all([
          ...[source, destination].map((domain) =>
            waitForSearchIndexed(
              apiContext,
              domain.responseData.fullyQualifiedName,
              'domain'
            )
          ),
          ...products.map((product) =>
            waitForSearchIndexed(
              apiContext,
              product.responseData.fullyQualifiedName,
              'dataProduct'
            )
          ),
        ]);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      test.setTimeout(180_000);
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        const results = await Promise.allSettled(
          products.map((product) => product.delete(apiContext))
        );
        expect(results.filter(({ status }) => status === 'rejected')).toEqual(
          []
        );
      } finally {
        try {
          const results = await Promise.allSettled(
            [source, destination].map((domain) => domain.delete(apiContext))
          );
          expect(results.filter(({ status }) => status === 'rejected')).toEqual(
            []
          );
        } finally {
          await afterAction();
        }
      }
    });

    test('switching from page three shows the next domain first page and preserves page size', async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width: 1920, height: 1080 });
      await adminPage.goto(
        `/domain?q=${prefix}&domainType.keyword=Aggregate&pageSize=25&paginationTest=retained`,
        { waitUntil: 'domcontentloaded' }
      );
      await adminPage.getByRole('radio', { name: 'tree', exact: true }).check();
      await adminPage
        .getByRole('row', { name: source.data.displayName, exact: true })
        .click();
      await expect(
        adminPage.getByTestId('entity-header-display-name')
      ).toHaveText(source.data.displayName);
      await adminPage.getByTestId('assets').click();

      await test.step('Page through the source domain data products', async () => {
        const firstPage = adminPage.waitForResponse(productResponse(source, 0));
        await adminPage.getByTestId('data_products').click();
        expect((await firstPage).status()).toBe(200);
        await expect(adminPage.getByTestId('page-indicator')).toContainText(
          'Page 1 of 3'
        );
        for (const from of [25, 50]) {
          const nextPage = adminPage.waitForResponse(
            productResponse(source, from)
          );
          await clickIgnoringToasts(adminPage.getByTestId('next'));
          expect((await nextPage).status()).toBe(200);
        }
        await expect(adminPage.getByTestId('page-indicator')).toContainText(
          'Page 3 of 3'
        );
        await expect(adminPage).toHaveURL(/currentPage=3/);
      });

      await test.step('Switch domains and verify the first page from the real search API', async () => {
        const destinationRequests: Request[] = [];
        const recordRequest = (request: Request) => {
          if (isProductPage(request, destination))
            destinationRequests.push(request);
        };
        adminPage.on('request', recordRequest);
        try {
          await adminPage
            .getByRole('row', {
              name: destination.data.displayName,
              exact: true,
            })
            .click();
          await expect(
            adminPage.getByTestId('entity-header-display-name')
          ).toHaveText(destination.data.displayName);
          await adminPage.getByTestId('assets').click();
          const firstPage = adminPage.waitForResponse(
            productResponse(destination, 0)
          );
          await adminPage.getByTestId('data_products').click();
          expect((await firstPage).status()).toBe(200);
          await waitForAllLoadersToDisappear(adminPage);
          await expect(
            adminPage.getByTestId(`explore-card-${prefix}_destination_product`)
          ).toBeVisible();
          await expect(adminPage.getByTestId('page-indicator')).toContainText(
            'Page 1 of 1'
          );
          await expect(adminPage.getByTestId('previous')).toBeDisabled();
          await expect(
            adminPage.getByTestId('page-size-selection-dropdown')
          ).toHaveText('25 / Page');
          expect(destinationRequests.length).toBeGreaterThan(0);
          expect(
            destinationRequests.every(
              (request) =>
                new URL(request.url()).searchParams.get('from') === '0'
            )
          ).toBe(true);
          const url = new URL(adminPage.url());
          expect(url.searchParams.get('currentPage')).toBeNull();
          expect(url.searchParams.get('pageSize')).toBe('25');
          expect(url.searchParams.get('q')).toBe(prefix);
          expect(url.searchParams.get('domainType.keyword')).toBe('Aggregate');
          expect(url.searchParams.get('paginationTest')).toBe('retained');
        } finally {
          adminPage.off('request', recordRequest);
        }
      });
    });

    test('a standalone domain details link retains its requested third page', async ({
      adminPage,
    }) => {
      const pageThree = adminPage.waitForResponse(productResponse(source, 50));
      await adminPage.goto(
        `/domain/${encodeURIComponent(
          source.responseData.fullyQualifiedName ?? source.data.name
        )}/data_products?currentPage=3&pageSize=25`,
        { waitUntil: 'domcontentloaded' }
      );
      expect((await pageThree).status()).toBe(200);
      await expect(adminPage.getByTestId('page-indicator')).toContainText(
        'Page 3 of 3'
      );
      await expect(
        adminPage.getByTestId('page-size-selection-dropdown')
      ).toHaveText('25 / Page');
      await expect(adminPage).toHaveURL(/currentPage=3/);
    });
  }
);
