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

import { APIRequestContext } from '@playwright/test';
import { OntologyPackInstallResult } from '../../../src/generated/api/data/ontologyPackInstallResult';
import { Glossary } from '../../../src/generated/entity/data/glossary';
import { EXTENDED_TEST_TIMEOUT } from '../../constant/common';
import { expect, test } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { navigateToOntologyStudio } from '../../utils/ontologyStudio';

const TARGET_GLOSSARY = `pw_isa95_${uuid().replaceAll('-', '')}`;
const ISA95_VERSION = '2025Q1-om1';

const isInstallResult = (value: unknown): value is OntologyPackInstallResult =>
  typeof value === 'object' &&
  value !== null &&
  'packId' in value &&
  value.packId === 'isa-95' &&
  'version' in value &&
  value.version === ISA95_VERSION &&
  'moduleIds' in value &&
  Array.isArray(value.moduleIds);

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
    `/api/v1/glossaries/name/${encodeURIComponent(TARGET_GLOSSARY)}`
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

  test('imports the ISA-95 starter into a glossary and opens its graph', async ({
    browser,
  }) => {
    test.setTimeout(EXTENDED_TEST_TIMEOUT);
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });

    try {
      await navigateToOntologyStudio(page);
      await page.getByTestId('ontology-library-trigger').click();

      await expect(page.getByTestId('ontology-pack-catalogue')).toBeVisible();
      await expect(
        page.getByTestId('ontology-pack-details-dcat')
      ).toBeVisible();
      await expect(
        page.getByTestId('ontology-pack-details-isa-95')
      ).toBeVisible();

      await page.getByTestId('ontology-pack-details-isa-95').click();
      await expect(page.getByTestId('ontology-pack-detail')).toBeVisible();
      await expect(page.getByTestId('ontology-pack-concept-count')).toHaveText(
        '9 Concepts'
      );
      await expect(
        page.getByTestId('ontology-pack-relationship-count')
      ).toHaveText('7 Hierarchy links');

      await page
        .getByTestId('ontology-pack-target-glossary')
        .fill(TARGET_GLOSSARY);
      await expect(page.getByTestId('ontology-pack-install')).toBeDisabled();
      await page.getByTestId('ontology-pack-dry-run').click();
      await expect(page.getByText('Dry run completed')).toBeVisible();
      await expect(
        page.getByText('9 concepts and 7 relationships')
      ).toBeVisible();

      const installResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/ontologyPacks/isa-95/install') &&
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

      expect(installBody.moduleIds).toHaveLength(1);
      expect(installBody).toMatchObject({
        targetGlossaryName: TARGET_GLOSSARY,
        dryRun: false,
        conceptCount: 9,
        relationshipCount: 7,
        importResults: [{ termsCreated: 9 }],
      });
      expect(installBody).not.toHaveProperty('installation');
      await expect(
        page
          .getByTestId('ontology-pack-detail')
          .getByText('Ontology pack installed')
      ).toBeVisible();

      await expect
        .poll(async () => (await loadInstalledGlossary(apiContext))?.name, {
          message: 'Imported glossary was not persisted',
          timeout: 30_000,
        })
        .toBe(TARGET_GLOSSARY);
      expect(await loadInstalledGlossary(apiContext)).not.toHaveProperty(
        'ontologyConfiguration'
      );

      await page.getByTestId('ontology-pack-open-graph').click();
      await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(
        page.getByTestId('ontology-scope-menu-trigger')
      ).toContainText(TARGET_GLOSSARY);
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    } finally {
      await afterAction();
    }
  });
});
