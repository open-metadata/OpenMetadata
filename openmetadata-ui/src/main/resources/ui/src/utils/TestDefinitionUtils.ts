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

import { ProviderType } from '../generated/entity/bot';
import {
  TestDefinition,
  TestPlatform,
} from '../generated/tests/testDefinition';

/**
 * Test definitions OpenMetadata ships with. Everything about them is fixed except the data
 * quality dimension, which users may reclassify — under a custom dimension of their own, say —
 * so that their test cases are reported the way their governance framework expects.
 */
export const isSystemTestDefinition = (
  testDefinition?: TestDefinition
): boolean => testDefinition?.provider === ProviderType.System;

export const isExternalTestDefinition = (
  testDefinition?: TestDefinition
): boolean => {
  if (
    !testDefinition?.testPlatforms ||
    testDefinition.testPlatforms.length === 0
  ) {
    return false;
  }

  return !testDefinition.testPlatforms.includes(TestPlatform.OpenMetadata);
};

export const mapUrlValueToOption = (
  value: string,
  options?: Array<{ key: string; label: string }>
): { key: string; label: string } => {
  const option = options?.find((opt) => opt.key === value);

  return { key: value, label: option?.label || value };
};
