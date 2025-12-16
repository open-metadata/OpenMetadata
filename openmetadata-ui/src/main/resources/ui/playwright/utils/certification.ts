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
import { APIRequestContext, Page } from '@playwright/test';

export const setTagDisabled = async (
  apiContext: APIRequestContext,
  tagId: string,
  disabled: boolean
) => {
  await apiContext.patch(`/api/v1/tags/${tagId}`, {
    data: [{ op: disabled ? 'add' : 'remove', path: '/disabled', value: true }],
    headers: { 'Content-Type': 'application/json-patch+json' },
  });
};

export const setCertificationClassificationDisabled = async (
  apiContext: APIRequestContext,
  disabled: boolean
) => {
  const response = await apiContext.get(
    '/api/v1/classifications/name/Certification'
  );
  const classification = await response.json();

  await apiContext.patch(`/api/v1/classifications/${classification.id}`, {
    data: [{ op: disabled ? 'add' : 'remove', path: '/disabled', value: true }],
    headers: { 'Content-Type': 'application/json-patch+json' },
  });
};

export const openCertificationDropdown = async (page: Page) => {
  const certificationResponse = page.waitForResponse(
    '/api/v1/tags?*parent=Certification*'
  );
  await page.getByTestId('edit-certification').click();
  await certificationResponse;
  await page.waitForSelector('.certification-card-popover', {
    state: 'visible',
  });
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
};

export const closeCertificationDropdown = async (page: Page) => {
  await page.getByTestId('close-certification').click();
  await page.waitForSelector('.certification-card-popover', {
    state: 'hidden',
  });
};

export const SYSTEM_CERTIFICATION_TAGS = [
  'Certification.Gold',
  'Certification.Silver',
  'Certification.Bronze',
];

export const getTagByFqn = async (
  apiContext: APIRequestContext,
  tagFqn: string
) => {
  const response = await apiContext.get(
    `/api/v1/tags/name/${encodeURIComponent(tagFqn)}`
  );

  return await response.json();
};

export const setTagDisabledByFqn = async (
  apiContext: APIRequestContext,
  tagFqn: string,
  disabled: boolean
) => {
  const tag = await getTagByFqn(apiContext, tagFqn);
  await setTagDisabled(apiContext, tag.id, disabled);
};

export const setAllSystemCertificationTagsDisabled = async (
  apiContext: APIRequestContext,
  disabled: boolean
) => {
  for (const tagFqn of SYSTEM_CERTIFICATION_TAGS) {
    await setTagDisabledByFqn(apiContext, tagFqn, disabled);
  }
};
