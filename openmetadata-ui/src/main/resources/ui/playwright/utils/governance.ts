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

/** Shared helpers for the Profile Governance tab (glossary relations + intake forms). */
import { APIRequestContext, expect, Page } from '@playwright/test';
import { enableAiAppMode } from '../e2e/Utils/appMode';
import { chooseSelectOption, redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';

// ─── Constants ────────────────────────────────────────────────────────────────

export const RELATION_TYPES_API = '/api/v1/relationshipTypes';
export const INTAKE_FORMS_API = '/api/v1/governance/intakeForms';

// ─── API helpers ──────────────────────────────────────────────────────────────

export type RelationTypePayload = { name: string; displayName: string };
export type RelationshipTypeResponse = RelationTypePayload & { id: string };

export const createRelationTypeViaApi = async (
  apiContext: APIRequestContext,
  payload: RelationTypePayload
): Promise<RelationshipTypeResponse> => {
  const response = await apiContext.post(RELATION_TYPES_API, {
    data: {
      ...payload,
      category: 'CUSTOM',
      description: '',
      paletteKey: 'VIOLET',
      rdfPredicate: `https://example.org/${payload.name}`,
    },
  });
  expect(response.status()).toBe(201);

  return response.json() as Promise<RelationshipTypeResponse>;
};

export const deleteRelationTypeViaApi = async (
  apiContext: APIRequestContext,
  id: string
) => {
  const response = await apiContext.delete(`${RELATION_TYPES_API}/${id}`);
  expect([200, 204, 404]).toContain(response.status());
};

export const deleteRelationTypeByNameViaApi = async (
  apiContext: APIRequestContext,
  name: string
) => {
  const response = await apiContext.get(
    `${RELATION_TYPES_API}/name/${encodeURIComponent(name)}`
  );
  if (response.ok()) {
    const rt = (await response.json()) as RelationshipTypeResponse;
    await deleteRelationTypeViaApi(apiContext, rt.id);
  }
};

export const ensureNoIntakeForm = async (
  apiContext: APIRequestContext,
  entityType: string
) => {
  const listRes = await apiContext.get(
    `${INTAKE_FORMS_API}?limit=100&include=all`
  );
  if (listRes.status() !== 200) {
    return;
  }
  const list = await listRes.json();
  const forms = (list.data ?? []) as Array<{ id: string; entityType: string }>;
  for (const form of forms) {
    if (form.entityType === entityType) {
      const del = await apiContext.delete(
        `${INTAKE_FORMS_API}/${form.id}?hardDelete=true`
      );
      expect([200, 204, 404]).toContain(del.status());
    }
  }
};

export const ensureCustomProperty = async (
  apiContext: APIRequestContext,
  entityType: string,
  propertyName: string,
  propertyTypeName: string
) => {
  const typeRes = await apiContext.get(
    `/api/v1/metadata/types/name/${entityType}?fields=customProperties`
  );
  expect(typeRes.status()).toBe(200);
  const type = await typeRes.json();
  const existing = (type.customProperties ?? []).find(
    (cp: { name: string }) => cp.name === propertyName
  );
  if (existing) {
    return;
  }
  const propTypeRes = await apiContext.get(
    `/api/v1/metadata/types/name/${propertyTypeName}`
  );
  expect(propTypeRes.status()).toBe(200);
  const propType = await propTypeRes.json();
  const put = await apiContext.put(`/api/v1/metadata/types/${type.id}`, {
    data: {
      name: propertyName,
      description: 'Custom property registered by ProfileModalGovernance test',
      propertyType: { id: propType.id, type: 'type' },
    },
  });
  expect(put.status()).toBe(200);
};

// ─── UI helpers ───────────────────────────────────────────────────────────────

/** Open the profile modal and navigate to the Governance tab. */
export const openGovernanceSettings = async (page: Page): Promise<void> => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('ai-profile-page').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('profile-nav-governance').click();
  await page.getByTestId('governance-landing').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

/** Navigate to the Glossary Relations list from the landing. */
export const navigateToGlossaryList = async (page: Page): Promise<void> => {
  const listResponse = page.waitForResponse(
    (r) =>
      r.url().includes(RELATION_TYPES_API) && r.request().method() === 'GET'
  );
  await page.getByTestId('governance-card-glossary-relations').click();
  await listResponse;
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('relation-types-table')).toBeVisible();
};

/** Navigate to the Intake Forms list from the landing. */
export const navigateToIntakeList = async (page: Page): Promise<void> => {
  const listResponse = page.waitForResponse(
    (r) => r.url().includes(INTAKE_FORMS_API) && r.request().method() === 'GET'
  );
  await page.getByTestId('governance-card-intake-forms').click();
  await listResponse;
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('add-intake-form')).toBeVisible();
};

/** Navigate back to the landing via the breadcrumb. */
export const backToLanding = async (page: Page): Promise<void> => {
  const landing = page.getByTestId('governance-landing');
  await page
    .getByTestId('profile-content-header')
    .getByLabel('Breadcrumb')
    .getByText('Governance', { exact: true })
    .click();
  await landing.waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const fillInput = async (page: Page, testId: string, value: string) => {
  await page.getByTestId(testId).locator('input').fill(value);
};

export const fillTextArea = async (
  page: Page,
  testId: string,
  value: string
) => {
  await page.getByTestId(testId).locator('textarea').fill(value);
};

export const selectOption = async (
  page: Page,
  testId: string,
  option: string
) => {
  await chooseSelectOption(
    page.getByTestId(testId),
    page.getByRole('option', { name: option, exact: true })
  );
};

/** Scroll through paginated table to find a row by test-id. */
export const findRowAcrossPages = async (
  page: Page,
  testId: string
): Promise<void> => {
  const target = page.getByTestId(testId);

  while (true) {
    const found = await target
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(
        () => true,
        () => false
      );

    if (found) {
      return;
    }

    const nextBtn = page.getByRole('button', { name: 'Next Page' });

    if ((await nextBtn.count()) === 0 || !(await nextBtn.isEnabled())) {
      throw new Error(`testId "${testId}" not found on any page`);
    }

    const currentPage = page.getByLabel('Current page');
    const pageNumber = Number(await currentPage.inputValue());
    await nextBtn.click();
    await expect(currentPage).toHaveValue(String(pageNumber + 1));
    await page
      .getByTestId('relation-types-table')
      .locator('tbody tr')
      .waitFor({ state: 'visible', timeout: 5_000 });
  }
};
