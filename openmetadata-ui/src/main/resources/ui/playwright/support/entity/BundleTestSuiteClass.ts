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

const PIPELINE_REQUEST_MAX_ATTEMPTS = 4;
const PIPELINE_REQUEST_RETRY_INTERVAL_MS = 5000;
const PIPELINE_DEPLOYMENT_SETTLE_MS = 5000;

const wait = (timeout: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, timeout));

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
          enableStreamableLogs: true,
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
    await this.executePipelineRequest('deploy', pipelineId, () =>
      apiContext.post(
        `/api/v1/services/ingestionPipelines/deploy/${pipelineId}`
      )
    );
    await wait(PIPELINE_DEPLOYMENT_SETTLE_MS);
    await this.executePipelineRequest('trigger', pipelineId, () =>
      apiContext.post(
        `/api/v1/services/ingestionPipelines/trigger/${pipelineId}`
      )
    );
  }

  private async executePipelineRequest(
    action: string,
    pipelineId: string,
    request: () => ReturnType<APIRequestContext['post']>
  ) {
    let lastStatus: number | undefined;
    let lastBody = '';

    for (let attempt = 1; attempt <= PIPELINE_REQUEST_MAX_ATTEMPTS; attempt++) {
      const response = await request();

      if (response.ok()) {
        return;
      }

      lastStatus = response.status();
      lastBody = await response.text();

      if (attempt < PIPELINE_REQUEST_MAX_ATTEMPTS) {
        await wait(PIPELINE_REQUEST_RETRY_INTERVAL_MS);
      }
    }

    throw new Error(
      `Failed to ${action} pipeline ${pipelineId}: ${lastStatus} ${lastBody}`
    );
  }
}
