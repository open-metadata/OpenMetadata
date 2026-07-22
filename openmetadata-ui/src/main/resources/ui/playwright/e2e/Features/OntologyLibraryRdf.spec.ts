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

import { APIRequestContext, expect, test } from '@playwright/test';
import { OntologyPackInstallResult } from '../../../src/generated/api/data/ontologyPackInstallResult';
import { Glossary } from '../../../src/generated/entity/data/glossary';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { navigateToOntologyExplorer } from '../../utils/ontologyExplorer';

const TARGET_GLOSSARY = `pw_fibo_${uuid().replaceAll('-', '')}`;
const FIBO_VERSION = '2025Q1-om1';
const SHA_256 = /^[a-f0-9]{64}$/;

const isInstallResult = (value: unknown): value is OntologyPackInstallResult =>
  typeof value === 'object' &&
  value !== null &&
  'packId' in value &&
  value.packId === 'fibo' &&
  'version' in value &&
  value.version === FIBO_VERSION &&
  'installation' in value &&
  typeof value.installation === 'object' &&
  value.installation !== null;

const isGlossary = (value: unknown): value is Glossary =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  value.name === TARGET_GLOSSARY;

const deleteInstalledGlossary = async (
  apiContext: APIRequestContext
): Promise<void> => {
  const response = await apiContext.delete(
    `/api/v1/glossaries/name/${encodeURIComponent(
      TARGET_GLOSSARY
    )}?recursive=true&hardDelete=true`
  );

  if (!response.ok() && response.status() !== 404) {
    throw new Error(
      `Could not remove installed ontology pack: HTTP ${response.status()}`
    );
  }
};

const loadInstalledGlossary = async (
  apiContext: APIRequestContext
): Promise<Glossary | undefined> => {
  const response = await apiContext.get(
    `/api/v1/glossaries/name/${encodeURIComponent(
      TARGET_GLOSSARY
    )}?fields=ontologyConfiguration`
  );
  const body: unknown = response.ok() ? await response.json() : undefined;

  return isGlossary(body) ? body : undefined;
};

test.describe('Ontology Library', { tag: ['@ontology-rdf'] }, () => {
  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await deleteInstalledGlossary(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('installs a dependency-aware FIBO pack with durable provenance and opens its graph', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await navigateToOntologyExplorer(page);
      await page.getByTestId('ontology-library-trigger').click();

      await expect(page.getByTestId('ontology-pack-catalogue')).toBeVisible();
      await expect(
        page.getByTestId('ontology-pack-details-fibo')
      ).toBeVisible();
      await expect(
        page.getByTestId('ontology-pack-details-isa-95')
      ).toBeVisible();

      await page.getByTestId('ontology-pack-details-fibo').click();
      await expect(page.getByTestId('ontology-pack-detail')).toBeVisible();
      await expect(page.getByTestId('ontology-pack-concept-count')).toHaveText(
        '8'
      );
      await expect(
        page.getByTestId('ontology-pack-relationship-count')
      ).toHaveText('6');

      await page.getByTestId('ontology-module-foundations').click();
      await expect(page.getByTestId('ontology-pack-concept-count')).toHaveText(
        '0'
      );
      await page.getByTestId('ontology-module-business-entities').click();
      await expect(page.getByTestId('ontology-pack-concept-count')).toHaveText(
        '8'
      );
      await expect(
        page.getByTestId('ontology-pack-relationship-count')
      ).toHaveText('6');

      await page
        .getByTestId('ontology-pack-target-glossary')
        .fill(TARGET_GLOSSARY);
      await expect(page.getByTestId('ontology-pack-install')).toBeDisabled();
      await page.getByTestId('ontology-pack-dry-run').click();
      await expect(page.getByText('Dry run completed')).toBeVisible();
      await expect(
        page.getByText('8 concepts and 6 relationships')
      ).toBeVisible();

      const installResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/ontologyPacks/fibo/install') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('ontology-pack-install').click();
      const installResponse = await installResponsePromise;
      const installBody: unknown = await installResponse.json();

      expect(installResponse.ok()).toBeTruthy();
      expect(isInstallResult(installBody)).toBeTruthy();

      if (!isInstallResult(installBody)) {
        throw new Error('Ontology pack install response is not valid');
      }

      expect(installBody.installation?.modules).toHaveLength(2);
      expect(
        installBody.installation?.modules.every((module) =>
          SHA_256.test(module.sha256)
        )
      ).toBe(true);
      await expect(
        page.getByText('Ontology pack installed').first()
      ).toBeVisible();
      await expect(page.getByText(`Installed · ${FIBO_VERSION}`)).toBeVisible();

      await expect
        .poll(() => loadInstalledGlossary(apiContext), {
          message: 'Installed glossary provenance was not persisted',
          timeout: 30_000,
        })
        .toMatchObject({
          ontologyConfiguration: {
            installedPacks: [
              {
                packId: 'fibo',
                version: FIBO_VERSION,
              },
            ],
            readOnly: false,
          },
        });

      await page.getByTestId('ontology-pack-open-graph').click();
      await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(
        page.getByTestId('ontology-glossary-menu-trigger')
      ).toContainText(TARGET_GLOSSARY);
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();

      await page.getByTestId('ontology-library-trigger').click();
      await expect(page.getByTestId('ontology-pack-fibo')).toContainText(
        'Installed'
      );
      await page.getByTestId('ontology-pack-fibo').click();
      await expect(page.getByTestId('ontology-pack-detail')).toContainText(
        `Installed · ${FIBO_VERSION}`
      );
    } finally {
      await afterAction();
    }
  });
});
