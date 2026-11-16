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

import { UseFormReturn } from 'react-hook-form';
import { TableProfilerConfig } from '../../../../generated/entity/data/table';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import { FormValues } from '../../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.interface';

export interface ThresholdPreviewProps {
  form: UseFormReturn<FormValues>;
  definition: TestDefinition;
  /** Column name for column-level tests, table name for table-level ones. */
  target?: string;
  /** Profiler config of the table under test, for the sampling note. */
  profilerConfig?: TableProfilerConfig;
}
