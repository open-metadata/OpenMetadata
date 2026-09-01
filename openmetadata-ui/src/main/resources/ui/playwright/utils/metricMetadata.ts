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
import {
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';

export interface MetricMetadataReference {
  displayName?: string;
  fullyQualifiedName?: string;
  id: string;
  name?: string;
  type?: string;
}

export interface MetricMetadataResponse {
  dataProducts?: MetricMetadataReference[];
  domains?: MetricMetadataReference[];
  owners?: MetricMetadataReference[];
  tags?: Array<{
    source?: string;
    tagFQN: string;
  }>;
}

export const openMetricMetadataEditor = async (page: Page) => {
  await expect(page.getByTestId('edit-metric-metadata')).toBeVisible();
  await page.getByTestId('edit-metric-metadata').click();

  const dialog = page.getByTestId('metric-metadata-edit-dialog');
  await expect(dialog).toBeVisible();

  return dialog;
};

export const setMetricMetadataReferenceSelection = async (
  dialog: Locator,
  groupName: string,
  referenceName: string,
  isSelected: boolean
) => {
  const group = dialog.getByRole('group', {
    exact: true,
    name: groupName,
  });
  await expect(group).toBeVisible();

  const searchInput = group.getByRole('textbox', {
    exact: true,
    name: `Search ${groupName}`,
  });
  await expect(searchInput).toBeEnabled({ timeout: 60_000 });

  const checkbox = group.getByRole('checkbox', {
    exact: true,
    name: referenceName,
  });
  // Changing the query forces a refetch while newly created fixtures propagate
  // to the search index; repeatedly filling the same value does not.
  const alternateSearch =
    referenceName.length > 1 ? referenceName.slice(0, -1) : referenceName;
  let searchWithExactName = true;
  await expect(async () => {
    await searchInput.fill(
      searchWithExactName || !alternateSearch ? referenceName : alternateSearch
    );
    searchWithExactName = !searchWithExactName;
    await expect(checkbox).toBeVisible({ timeout: 5_000 });
  }).toPass({ intervals: [1_000, 2_000, 5_000], timeout: 60_000 });
  if ((await checkbox.isChecked()) !== isSelected) {
    await checkbox.focus();
    await checkbox.press('Space');
  }
  if (isSelected) {
    await expect(checkbox).toBeChecked();
  } else {
    await expect(checkbox).not.toBeChecked();
  }

  return group;
};

export const selectMetricMetadataReference = async (
  dialog: Locator,
  groupName: string,
  referenceName: string
) => {
  return setMetricMetadataReferenceSelection(
    dialog,
    groupName,
    referenceName,
    true
  );
};

export const expectMetricMetadataSelections = async (
  group: Locator,
  included: string[],
  excluded: string[] = []
) => {
  const selected = group.getByLabel('selected', { exact: true });
  if (included.length === 0) {
    await expect(selected).toHaveCount(0);

    return;
  }
  await expect(selected).toBeVisible();

  for (const referenceName of included) {
    await expect(selected).toContainText(referenceName);
  }
  for (const referenceName of excluded) {
    await expect(selected).not.toContainText(referenceName);
  }
};

export const saveMetricMetadata = async (
  page: Page,
  dialog: Locator,
  metricId: string
) => {
  const metricPath = `/api/v1/metrics/${metricId}`;
  let metricPatchCount = 0;
  const countMetricPatch = (request: Request) => {
    if (
      request.method() === 'PATCH' &&
      new URL(request.url()).pathname === metricPath
    ) {
      metricPatchCount += 1;
    }
  };
  page.on('request', countMetricPatch);

  try {
    const patchResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname === metricPath
    );
    await dialog.getByTestId('save-metric-metadata').click();

    const response = await patchResponse;
    expect(response.ok()).toBeTruthy();
    await expect(dialog).toBeHidden();
    expect(metricPatchCount).toBe(1);

    return response;
  } finally {
    page.off('request', countMetricPatch);
  }
};

export const getPersistedMetricMetadata = async (
  apiContext: APIRequestContext,
  metricId: string
) => {
  const response = await apiContext.get(
    `/api/v1/metrics/${metricId}?fields=owners,domains,dataProducts,tags`
  );
  expect(response.ok()).toBeTruthy();

  return (await response.json()) as MetricMetadataResponse;
};
