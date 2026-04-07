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
import { uuid } from '../../utils/common';
import { ResponseDataType } from './Entity.interface';

export class BundleTestSuiteClass {
  bundleTestSuiteResponseData: ResponseDataType = {} as ResponseDataType;

  async createBundleTestSuite(apiContext: APIRequestContext) {
    const testSuiteData = await apiContext
      .post('/api/v1/dataQuality/testSuites', {
        data: {
          name: `pw-bundle-suite-${uuid()}`,
          description: 'Playwright bundle test suite for logs viewer e2e',
        },
      })
      .then((res) => res.json());

    this.bundleTestSuiteResponseData = testSuiteData;

    return testSuiteData;
  }

  async createBundleTestSuitePipeline(apiContext: APIRequestContext) {
    const testSuiteData = this.bundleTestSuiteResponseData;
    if (!testSuiteData?.id || !testSuiteData?.fullyQualifiedName) {
      throw new Error(
        'createBundleTestSuite must be called before createBundleTestSuitePipeline'
      );
    }

    const pipelineData = await apiContext
      .post('/api/v1/services/ingestionPipelines', {
        data: {
          airflowConfig: {
            scheduleInterval: '0 * * * *',
          },
          name: `pw-bundle-suite-pipeline-${uuid()}`,
          loggerLevel: 'INFO',
          pipelineType: 'TestSuite',
          service: {
            id: testSuiteData.id,
            type: 'testSuite',
          },
          sourceConfig: {
            config: {
              type: 'TestSuite',
              entityFullyQualifiedName: testSuiteData.fullyQualifiedName,
            },
          },
        },
      })
      .then((res) => res.json());

    return { pipeline: pipelineData };
  }

  async runIngestionPipeline(
    apiContext: APIRequestContext,
    pipelineId: string
  ) {
    await apiContext.post(
      `/api/v1/services/ingestionPipelines/deploy/${pipelineId}`
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const triggerResponse = await apiContext.post(
      `/api/v1/services/ingestionPipelines/trigger/${pipelineId}`
    );
    if (triggerResponse.status() !== 200) {
      throw new Error(
        `Failed to trigger pipeline ${pipelineId}: ${triggerResponse.status()}`
      );
    }
  }
}
