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
import { ApiEndpointClass } from '../../../support/entity/ApiEndpointClass';
import { DashboardDataModelClass } from '../../../support/entity/DashboardDataModelClass';
import { MlModelClass } from '../../../support/entity/MlModelClass';
import { SearchIndexClass } from '../../../support/entity/SearchIndexClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

/**
 * Task Tests for Entities with Nested Field Structures
 *
 * Tests task workflows for entities with nested schema/field structures:
 * - ApiEndpoint: requestSchema and responseSchema field descriptions
 * - DashboardDataModel: column descriptions
 * - MlModel: mlFeatures descriptions
 * - SearchIndex: fields with nested children descriptions
 */

test.describe('Task Resolution - ApiEndpoint Schema Fields', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const apiEndpoint = new ApiEndpointClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await apiEndpoint.create(apiContext);
      await apiContext.patch(
        `/api/v1/apiEndpoints/${apiEndpoint.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/owners',
              value: [{ id: ownerUser.responseData.id, type: 'user' }],
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await apiEndpoint.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve requestSchema field description task', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated requestSchema field description via task';

    try {
      // Get the apiEndpoint to find requestSchema field
      const response = await apiContext.get(
        `/api/v1/apiEndpoints/${apiEndpoint.entityResponseData?.id}?fields=requestSchema`
      );
      const data = await response.json();

      const schemaFields = data.requestSchema?.schemaFields;
      if (!schemaFields || schemaFields.length === 0) {
        console.log('No requestSchema fields, skipping test');
        return;
      }

      // Find a leaf field (e.g., default.age or default.club_name)
      let fieldPath = '';
      const findLeafField = (
        fields: Array<{ name: string; children?: unknown[] }>,
        parentPath = ''
      ): boolean => {
        for (const field of fields) {
          const currentPath = parentPath
            ? `${parentPath}.${field.name}`
            : field.name;
          if (!field.children || field.children.length === 0) {
            fieldPath = currentPath;
            return true;
          }
          if (
            findLeafField(
              field.children as Array<{ name: string; children?: unknown[] }>,
              currentPath
            )
          ) {
            return true;
          }
        }
        return false;
      };

      findLeafField(schemaFields);
      if (!fieldPath) {
        console.log('No leaf field found in requestSchema, skipping test');
        return;
      }

      // Create DescriptionUpdate task for requestSchema field
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: apiEndpoint.entityResponseData?.fullyQualifiedName,
          aboutType: 'apiEndpoint',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `requestSchema::${fieldPath}::description`,
            newDescription: newDescription,
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
            newValue: newDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve responseSchema field description task', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated responseSchema field description via task';

    try {
      // Get the apiEndpoint to find responseSchema field
      const response = await apiContext.get(
        `/api/v1/apiEndpoints/${apiEndpoint.entityResponseData?.id}?fields=responseSchema`
      );
      const data = await response.json();

      const schemaFields = data.responseSchema?.schemaFields;
      if (!schemaFields || schemaFields.length === 0) {
        console.log('No responseSchema fields, skipping test');
        return;
      }

      // Find a leaf field
      let fieldPath = '';
      const findLeafField = (
        fields: Array<{ name: string; children?: unknown[] }>,
        parentPath = ''
      ): boolean => {
        for (const field of fields) {
          const currentPath = parentPath
            ? `${parentPath}.${field.name}`
            : field.name;
          if (!field.children || field.children.length === 0) {
            fieldPath = currentPath;
            return true;
          }
          if (
            findLeafField(
              field.children as Array<{ name: string; children?: unknown[] }>,
              currentPath
            )
          ) {
            return true;
          }
        }
        return false;
      };

      findLeafField(schemaFields);
      if (!fieldPath) {
        console.log('No leaf field found in responseSchema, skipping test');
        return;
      }

      // Create DescriptionUpdate task for responseSchema field
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: apiEndpoint.entityResponseData?.fullyQualifiedName,
          aboutType: 'apiEndpoint',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `responseSchema::${fieldPath}::description`,
            newDescription: newDescription,
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
            newValue: newDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - DashboardDataModel Columns', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const dashboardDataModel = new DashboardDataModelClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await dashboardDataModel.create(apiContext);
      await apiContext.patch(
        `/api/v1/dashboard/datamodels/${dashboardDataModel.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/owners',
              value: [{ id: ownerUser.responseData.id, type: 'user' }],
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await dashboardDataModel.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve column description task for DashboardDataModel', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated DashboardDataModel column description via task';

    try {
      // Get the dashboardDataModel to find column name
      const response = await apiContext.get(
        `/api/v1/dashboard/datamodels/${dashboardDataModel.entityResponseData?.id}?fields=columns`
      );
      const data = await response.json();

      const columns = data.columns;
      if (!columns || columns.length === 0) {
        console.log('No columns in DashboardDataModel, skipping test');
        return;
      }

      const columnName = columns[0].name;

      // Create DescriptionUpdate task for column
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: dashboardDataModel.entityResponseData?.fullyQualifiedName,
          aboutType: 'dashboardDataModel',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `columns::${columnName}::description`,
            newDescription: newDescription,
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
            newValue: newDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify column description was updated
      const updatedResponse = await apiContext.get(
        `/api/v1/dashboard/datamodels/${dashboardDataModel.entityResponseData?.id}?fields=columns`
      );
      const updatedData = await updatedResponse.json();

      const updatedColumn = updatedData.columns?.find(
        (col: { name: string }) => col.name === columnName
      );
      expect(updatedColumn?.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - MlModel Features', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const mlModel = new MlModelClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await mlModel.create(apiContext);
      await apiContext.patch(
        `/api/v1/mlmodels/${mlModel.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/owners',
              value: [{ id: ownerUser.responseData.id, type: 'user' }],
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await mlModel.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve mlFeature description task for MlModel', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated MlModel feature description via task';

    try {
      // Get the mlModel to find feature name
      const response = await apiContext.get(
        `/api/v1/mlmodels/${mlModel.entityResponseData?.id}?fields=mlFeatures`
      );
      const data = await response.json();

      const features = data.mlFeatures;
      if (!features || features.length === 0) {
        console.log('No mlFeatures in MlModel, skipping test');
        return;
      }

      const featureName = features[0].name;

      // Create DescriptionUpdate task for mlFeature
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: mlModel.entityResponseData?.fullyQualifiedName,
          aboutType: 'mlmodel',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `mlFeatures::${featureName}::description`,
            newDescription: newDescription,
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
            newValue: newDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify feature description was updated
      const updatedResponse = await apiContext.get(
        `/api/v1/mlmodels/${mlModel.entityResponseData?.id}?fields=mlFeatures`
      );
      const updatedData = await updatedResponse.json();

      const updatedFeature = updatedData.mlFeatures?.find(
        (f: { name: string }) => f.name === featureName
      );
      expect(updatedFeature?.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - SearchIndex Fields', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const searchIndex = new SearchIndexClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await searchIndex.create(apiContext);
      await apiContext.patch(
        `/api/v1/searchIndexes/${searchIndex.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/owners',
              value: [{ id: ownerUser.responseData.id, type: 'user' }],
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await searchIndex.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve field description task for SearchIndex', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated SearchIndex field description via task';

    try {
      // Get the searchIndex to find field name
      const response = await apiContext.get(
        `/api/v1/searchIndexes/${searchIndex.entityResponseData?.id}?fields=fields`
      );
      const data = await response.json();

      const fields = data.fields;
      if (!fields || fields.length === 0) {
        console.log('No fields in SearchIndex, skipping test');
        return;
      }

      // Find a leaf field (no children or empty children)
      let fieldPath = '';
      const findLeafField = (
        fieldList: Array<{ name: string; children?: unknown[] }>,
        parentPath = ''
      ): boolean => {
        for (const field of fieldList) {
          const currentPath = parentPath
            ? `${parentPath}.${field.name}`
            : field.name;
          if (!field.children || field.children.length === 0) {
            fieldPath = currentPath;
            return true;
          }
          if (
            findLeafField(
              field.children as Array<{ name: string; children?: unknown[] }>,
              currentPath
            )
          ) {
            return true;
          }
        }
        return false;
      };

      findLeafField(fields);
      if (!fieldPath) {
        // If no leaf found, just use the first field name
        fieldPath = fields[0].name;
      }

      // Create DescriptionUpdate task for field
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: searchIndex.entityResponseData?.fullyQualifiedName,
          aboutType: 'searchIndex',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `fields::${fieldPath}::description`,
            newDescription: newDescription,
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
            newValue: newDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve nested field description task for SearchIndex', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated nested SearchIndex field description via task';

    try {
      // Get the searchIndex to find nested field
      const response = await apiContext.get(
        `/api/v1/searchIndexes/${searchIndex.entityResponseData?.id}?fields=fields`
      );
      const data = await response.json();

      const fields = data.fields;
      if (!fields || fields.length === 0) {
        console.log('No fields in SearchIndex, skipping test');
        return;
      }

      // Find a nested field (field with children that has children)
      let nestedFieldPath = '';
      const findNestedLeafField = (
        fieldList: Array<{ name: string; children?: unknown[] }>,
        parentPath = '',
        depth = 0
      ): boolean => {
        if (depth > 0) {
          for (const field of fieldList) {
            const currentPath = parentPath
              ? `${parentPath}.${field.name}`
              : field.name;
            if (!field.children || field.children.length === 0) {
              nestedFieldPath = currentPath;
              return true;
            }
            if (
              findNestedLeafField(
                field.children as Array<{ name: string; children?: unknown[] }>,
                currentPath,
                depth + 1
              )
            ) {
              return true;
            }
          }
        } else {
          for (const field of fieldList) {
            if (field.children && field.children.length > 0) {
              const currentPath = parentPath
                ? `${parentPath}.${field.name}`
                : field.name;
              if (
                findNestedLeafField(
                  field.children as Array<{ name: string; children?: unknown[] }>,
                  currentPath,
                  depth + 1
                )
              ) {
                return true;
              }
            }
          }
        }
        return false;
      };

      findNestedLeafField(fields);
      if (!nestedFieldPath) {
        console.log('No nested fields found in SearchIndex, skipping test');
        return;
      }

      // Create DescriptionUpdate task for nested field
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: searchIndex.entityResponseData?.fullyQualifiedName,
          aboutType: 'searchIndex',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `fields::${nestedFieldPath}::description`,
            newDescription: newDescription,
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
            newValue: newDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });
});
