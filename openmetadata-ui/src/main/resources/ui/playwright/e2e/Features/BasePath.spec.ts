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
import { Response } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe(
  'Packaged deployment base path',
  { tag: ['@Features', '@Platform'] },
  () => {
    test('loads assets, API configuration and public navigation below the configured prefix', async ({
      page,
      baseURL,
    }) => {
      const deployment = new URL(baseURL ?? 'http://localhost:8585');
      const prefix = deployment.pathname.replace(/\/+$/, '');
      const signInUrl = new URL(
        `${prefix}/signin?basePathSmoke=true#entry`,
        deployment.origin
      );
      const assets: Response[] = [];
      const apiPaths: string[] = [];
      const basenameErrors: string[] = [];
      page.on('console', (message) => {
        if (message.text().includes('basename')) {
          basenameErrors.push(message.text());
        }
      });
      page.on('response', (response) => {
        const url = new URL(response.url());
        if (url.origin !== deployment.origin) {
          return;
        }
        if (
          ['script', 'stylesheet', 'image'].includes(
            response.request().resourceType()
          )
        ) {
          assets.push(response);
        }
        if (url.pathname.includes('/api/v1/')) {
          apiPaths.push(url.pathname);
        }
      });
      const authConfiguration = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          `${prefix}/api/v1/system/config/auth`
      );

      await test.step('Load the packaged public shell and its real configuration', async () => {
        const shell = await page.goto(signInUrl.toString(), {
          waitUntil: 'domcontentloaded',
        });
        expect(shell?.status()).toBe(200);
        expect((await authConfiguration).status()).toBe(200);
        await expect(page.getByTestId('login-form-container')).toBeVisible();
        await expect(page.getByTestId('login')).toBeVisible();
      });

      await test.step('Check browser-loaded bundles, styles, images and API prefixes', async () => {
        const iconPath = `${prefix}/favicons/apple-icon-57x57.png`;
        await expect(
          page.locator('link[rel="apple-touch-icon"][sizes="57x57"]')
        ).toHaveAttribute('href', iconPath);
        const imageResponse = page.waitForResponse(
          (response) => new URL(response.url()).pathname === iconPath
        );
        // The sign-in logo is inlined; load the shell's touch icon to exercise image serving.
        await page.evaluate(
          (path) =>
            new Promise<void>((resolve, reject) => {
              const image = new Image();
              image.onload = () => resolve();
              image.onerror = () => reject(new Error(`Cannot load ${path}`));
              image.src = path;
            }),
          iconPath
        );
        expect((await imageResponse).status()).toBe(200);
        for (const resourceType of ['script', 'stylesheet', 'image']) {
          await expect
            .poll(
              () =>
                assets.filter(
                  (response) =>
                    response.request().resourceType() === resourceType
                ).length
            )
            .toBeGreaterThan(0);
        }
        for (const response of assets) {
          expect(response.ok(), response.url()).toBe(true);
          expect(
            new URL(response.url()).pathname.startsWith(`${prefix}/`),
            response.url()
          ).toBe(true);
          expect(
            response.headers()['content-type'],
            response.url()
          ).not.toContain('text/html');
        }
        expect(apiPaths.length).toBeGreaterThan(0);
        for (const path of apiPaths) {
          expect(path.startsWith(`${prefix}/api/v1/`), path).toBe(true);
          expect(
            path.startsWith(`${prefix}${prefix}/api/`) && Boolean(prefix),
            path
          ).toBe(false);
        }
        expect(basenameErrors).toEqual([]);
      });

      await test.step('Navigate within the prefix and refresh a deep public route', async () => {
        await page.getByTestId('forgot-password').click();
        await expect(page).toHaveURL(
          new URL(`${prefix}/forgot-password`, deployment.origin).toString()
        );
        const refreshed = await page.reload({ waitUntil: 'domcontentloaded' });
        expect(refreshed?.status()).toBe(200);
        await expect(
          page.getByTestId('forgot-password-container')
        ).toBeVisible();
        await page.goto(signInUrl.toString(), {
          waitUntil: 'domcontentloaded',
        });
        await expect(page.getByTestId('login-form-container')).toBeVisible();
        expect(new URL(page.url()).search).toBe('?basePathSmoke=true');
        expect(new URL(page.url()).hash).toBe('#entry');
        expect(basenameErrors).toEqual([]);
      });
    });
  }
);
