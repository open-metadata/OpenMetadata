/*
 *  Copyright 2024 Collate.
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

import { OwnerType } from '../../../enums/user.enum';
import {
  CreateIngestionPipeline,
  FluffyType as ConfigType,
  PipelineType,
} from '../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { CreateTestSuite } from '../../../generated/api/tests/createTestSuite';
import { LogLevels } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestSuite } from '../../../generated/tests/testSuite';
import { getNameFromFQN } from '../../../utils/FqnUtils';
import { getIngestionName } from '../../../utils/ServicePureUtils';
import {
  generateUUID,
  replaceAllSpacialCharWith_,
} from '../../../utils/StringUtils';
import { BundleSuiteFormData } from './BundleSuiteForm.interface';

export const buildCreateTestSuite = (
  values: BundleSuiteFormData,
  currentUserId?: string
): CreateTestSuite => ({
  name: values.name,
  description: values.description,
  owners: currentUserId ? [{ id: currentUserId, type: OwnerType.USER }] : [],
});

export const buildBundlePipelinePayload = (
  values: BundleSuiteFormData,
  testSuite: TestSuite
): CreateIngestionPipeline => {
  const testSuiteName = replaceAllSpacialCharWith_(
    getNameFromFQN(testSuite.fullyQualifiedName ?? testSuite.name)
  );
  const pipelineName =
    values.pipelineName ||
    getIngestionName(testSuiteName, PipelineType.TestSuite);

  return {
    airflowConfig: {
      scheduleInterval: values.cron,
    },
    displayName: pipelineName,
    name: generateUUID(),
    loggerLevel: values.enableDebugLog ? LogLevels.Debug : LogLevels.Info,
    pipelineType: PipelineType.TestSuite,
    raiseOnError: values.raiseOnError ?? true,
    service: {
      id: testSuite.id ?? '',
      type: 'testSuite',
    },
    sourceConfig: {
      config: {
        type: ConfigType.TestSuite,
      },
    },
  };
};
