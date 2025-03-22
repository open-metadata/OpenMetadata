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

import { APIRequestContext, expect, Page } from '@playwright/test';
import { conditionalPermissionsEntityData } from '../constant/conditionalPermissions';
import {
  VIEW_ALL_WITH_IS_OWNER,
  VIEW_ALL_WITH_MATCH_TAG_CONDITION,
} from '../constant/permission';
import { TableClass } from '../support/entity/TableClass';
import { AssetTypes } from '../support/interfaces/ConditionalPermissions.interface';
import { redirectToHomePage } from './common';

export const conditionalPermissionsPrerequisites = async (
  apiContext: APIRequestContext
) => {
  const {
    isOwnerPolicy,
    matchAnyTagPolicy,
    isOwnerRole,
    matchAnyTagRole,
    userWithOwnerPermission,
    userWithTagPermission,
    withOwner,
    withTag,
  } = conditionalPermissionsEntityData;
  await userWithOwnerPermission.create(apiContext);
  await userWithTagPermission.create(apiContext);
  await withOwner.apiCollectionWithOwner.create(apiContext);
  await withTag.apiCollectionWithTag.create(apiContext);
  await withOwner.containerWithOwner.create(apiContext);
  await withTag.containerWithTag.create(apiContext);
  await withOwner.dashboardWithOwner.create(apiContext);
  await withTag.dashboardWithTag.create(apiContext);
  await withOwner.mlModelWithOwner.create(apiContext);
  await withTag.mlModelWithTag.create(apiContext);
  await withOwner.pipelineWithOwner.create(apiContext);
  await withTag.pipelineWithTag.create(apiContext);
  await withOwner.searchIndexWithOwner.create(apiContext);
  await withTag.searchIndexWithTag.create(apiContext);
  await withOwner.tableWithOwner.create(apiContext);
  await withTag.tableWithTag.create(apiContext);
  await withOwner.topicWithOwner.create(apiContext);
  await withTag.topicWithTag.create(apiContext);

  const isOwnerPolicyResponse = await isOwnerPolicy.create(
    apiContext,
    VIEW_ALL_WITH_IS_OWNER
  );
  const matchAnyTagPolicyResponse = await matchAnyTagPolicy.create(
    apiContext,
    VIEW_ALL_WITH_MATCH_TAG_CONDITION
  );

  const isOwnerRoleResponse = await isOwnerRole.create(apiContext, [
    isOwnerPolicyResponse.fullyQualifiedName,
  ]);
  const matchAnyTagRoleResponse = await matchAnyTagRole.create(apiContext, [
    matchAnyTagPolicyResponse.fullyQualifiedName,
  ]);

  await userWithOwnerPermission.patch({
    apiContext,
    patchData: [
      {
        op: 'replace',
        path: '/roles',
        value: [
          {
            id: isOwnerRoleResponse.id,
            type: 'role',
            name: isOwnerRoleResponse.name,
          },
        ],
      },
    ],
  });
  await userWithTagPermission.patch({
    apiContext,
    patchData: [
      {
        op: 'replace',
        path: '/roles',
        value: [
          {
            id: matchAnyTagRoleResponse.id,
            type: 'role',
            name: matchAnyTagRoleResponse.name,
          },
        ],
      },
    ],
  });

  const ownerPatchData = {
    data: [
      {
        op: 'replace',
        path: '/owners',
        value: [
          {
            id: userWithOwnerPermission.responseData.id,
            type: 'user',
          },
        ],
      },
    ],
    headers: {
      'Content-Type': 'application/json-patch+json',
    },
  };

  const tagPatchData = {
    data: [
      {
        op: 'replace',
        path: '/tags',
        value: [
          {
            tagFQN: 'PersonalData.Personal',
            source: 'Classification',
            labelType: 'Manual',
            name: 'Personal',
            state: 'Confirmed',
          },
        ],
      },
    ],
    headers: {
      'Content-Type': 'application/json-patch+json',
    },
  };

  for (const entity of Object.values(withOwner)) {
    await apiContext.patch(
      `/api/v1/services/${entity.serviceType}/${entity.serviceResponseData.id}`,
      ownerPatchData
    );
  }

  await apiContext.patch(
    `/api/v1/databases/${withOwner.tableWithOwner.databaseResponseData.id}`,
    ownerPatchData
  );

  await apiContext.patch(
    `/api/v1/databaseSchemas/${withOwner.tableWithOwner.schemaResponseData.id}`,
    ownerPatchData
  );

  await apiContext.patch(
    `/api/v1/containers/${withOwner.containerWithOwner.entityResponseData.id}`,
    ownerPatchData
  );

  for (const entity of Object.values(withTag)) {
    await apiContext.patch(
      `/api/v1/services/${entity.serviceType}/${entity.serviceResponseData.id}`,
      tagPatchData
    );
  }

  await apiContext.patch(
    `/api/v1/databases/${withTag.tableWithTag.databaseResponseData.id}`,
    tagPatchData
  );

  await apiContext.patch(
    `/api/v1/databaseSchemas/${withTag.tableWithTag.schemaResponseData.id}`,
    tagPatchData
  );

  await apiContext.patch(
    `/api/v1/containers/${withTag.containerWithTag.entityResponseData.id}`,
    tagPatchData
  );
};

export const conditionalPermissionsCleanup = async (
  apiContext: APIRequestContext
) => {
  const {
    isOwnerPolicy,
    matchAnyTagPolicy,
    isOwnerRole,
    matchAnyTagRole,
    userWithOwnerPermission,
    userWithTagPermission,
    withOwner: {
      apiCollectionWithOwner,
      containerWithOwner,
      dashboardWithOwner,
      mlModelWithOwner,
      pipelineWithOwner,
      searchIndexWithOwner,
      tableWithOwner,
      topicWithOwner,
    },
    withTag: {
      apiCollectionWithTag,
      containerWithTag,
      dashboardWithTag,
      mlModelWithTag,
      pipelineWithTag,
      searchIndexWithTag,
      tableWithTag,
      topicWithTag,
    },
  } = conditionalPermissionsEntityData;
  await isOwnerRole.delete(apiContext);
  await matchAnyTagRole.delete(apiContext);
  await isOwnerPolicy.delete(apiContext);
  await matchAnyTagPolicy.delete(apiContext);
  await userWithOwnerPermission.delete(apiContext);
  await userWithTagPermission.delete(apiContext);
  await apiCollectionWithOwner.delete(apiContext);
  await apiCollectionWithTag.delete(apiContext);
  await containerWithOwner.delete(apiContext);
  await containerWithTag.delete(apiContext);
  await dashboardWithOwner.delete(apiContext);
  await dashboardWithTag.delete(apiContext);
  await mlModelWithOwner.delete(apiContext);
  await mlModelWithTag.delete(apiContext);
  await pipelineWithOwner.delete(apiContext);
  await pipelineWithTag.delete(apiContext);
  await searchIndexWithOwner.delete(apiContext);
  await searchIndexWithTag.delete(apiContext);
  await tableWithOwner.delete(apiContext);
  await tableWithTag.delete(apiContext);
  await topicWithOwner.delete(apiContext);
  await topicWithTag.delete(apiContext);
};

export const getEntityFQN = (assetName: string, asset: AssetTypes) => {
  if (assetName === 'database') {
    return (asset as TableClass).databaseResponseData.fullyQualifiedName;
  }
  if (assetName === 'databaseSchema') {
    return (asset as TableClass).schemaResponseData.fullyQualifiedName;
  }
  if (assetName === 'container') {
    return asset.entityResponseData.fullyQualifiedName;
  }

  return asset.serviceResponseData.fullyQualifiedName;
};

export const checkViewAllPermission = async ({
  page,
  url1,
  url2,
  childTabId,
  childTabId2,
  childTableId2,
}: {
  page: Page;
  url1: string;
  url2: string;
  childTabId: string;
  childTabId2?: string;
  childTableId2?: string;
}) => {
  await redirectToHomePage(page);

  // visit the page of the asset with permission
  await page.goto(url1);

  // Check if the details are shown properly
  await expect(page.getByTestId('data-assets-header')).toBeAttached();

  await page.waitForSelector(`[data-testid="${childTabId}"]`);

  await page.click(`[data-testid="${childTabId}"]`);

  await expect(
    page
      .getByTestId('service-children-table')
      .getByTestId('no-data-placeholder')
  ).not.toBeAttached();

  if (childTabId2) {
    await page.click(`[data-testid="${childTabId2}"]`);

    await expect(
      page.getByTestId(childTableId2 ?? '').getByTestId('no-data-placeholder')
    ).not.toBeAttached();
  }

  // visit the page of the asset without permission
  await page.goto(url2);

  // Check if the no permissions placeholder is shown
  await expect(page.getByTestId('permission-error-placeholder')).toBeAttached();
};
