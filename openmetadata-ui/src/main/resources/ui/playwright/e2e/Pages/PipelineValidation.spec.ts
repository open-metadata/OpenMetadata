/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { expect, test, type APIRequestContext } from '@playwright/test';
import { getDefaultAdminAPIContext, uuid } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Pipeline validation', () => {
  let apiContext: APIRequestContext;
  let afterAction: (() => Promise<void>) | undefined;
  let serviceFqn = '';

  test.beforeAll(async ({ browser }) => {
    const response = await getDefaultAdminAPIContext(browser);

    apiContext = response.apiContext;
    afterAction = response.afterAction;

    const serviceName = `pw-pipeline-validation-service-${uuid()}`;
    const serviceResponse = await apiContext.post(
      '/api/v1/services/pipelineServices',
      {
        data: {
          name: serviceName,
          serviceType: 'Dagster',
          connection: {
            config: {
              type: 'Dagster',
              host: 'admin',
              token: 'admin',
              timeout: '1000',
              supportsMetadataExtraction: true,
            },
          },
        },
      }
    );

    expect(serviceResponse.status()).toBe(201);
    const serviceData = await serviceResponse.json();
    serviceFqn = serviceData.fullyQualifiedName;
  });

  test.afterAll(async () => {
    if (serviceFqn) {
      await apiContext.delete(
        `/api/v1/services/pipelineServices/name/${encodeURIComponent(
          serviceFqn
        )}?recursive=true&hardDelete=true`
      );
    }
    await afterAction?.();
  });

  test('should reject pipeline creation when a task name is empty', async () => {
    const pipelineName = `pw-pipeline-validation-${uuid()}`;
    const response = await apiContext.post('/api/v1/pipelines', {
      data: {
        name: pipelineName,
        service: serviceFqn,
        tasks: [{ name: '' }],
      },
    });

    expect(response.status()).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.message || responseBody.error).toBeDefined();
  });
});
