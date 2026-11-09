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
import { compare, Operation } from 'fast-json-patch';
import { camelCase, isUndefined } from 'lodash';
import {
  ConfigType,
  CreateIngestionPipeline,
  PipelineType,
} from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { Table } from '../../../../generated/entity/data/table';
import {
  IngestionPipeline,
  LogLevels,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { EntityReference } from '../../../../generated/type/entityReference';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import { getIngestionName } from '../../../../utils/ServicePureUtils';
import {
  generateUUID,
  replaceAllSpacialCharWith_,
} from '../../../../utils/StringUtils';
import {
  isSelectAllPayload,
  normalizeSelectedTestProp,
} from '../../AddTestCaseList/AddTestCaseListForm.utils';
import { TestSuiteIngestionDataType } from '../AddDataQualityTest.interface';
import { TestSuitePipelineFormValues } from './TestSuitePipelineFormFields';

export const toTestSuiteIngestionData = ({
  cron,
  enableDebugLog,
  testCases,
  name,
  selectAllTestCases,
  raiseOnError,
}: TestSuitePipelineFormValues): TestSuiteIngestionDataType => {
  // A picker "Select all N test cases" payload (`selectAll: true`) is
  // semantically "run every test case" — the same as the top-level
  // selectAllTestCases switch — so it must set selectAllTestCases so the
  // edit form re-opens with the switch on rather than the picker showing an
  // empty selection.
  const isPickerSelectAll = isSelectAllPayload(testCases);
  const testCaseNames = normalizeSelectedTestProp(testCases);

  return {
    cron,
    enableDebugLog,
    name,
    selectAllTestCases: selectAllTestCases || isPickerSelectAll,
    testCases: testCaseNames.length > 0 ? testCaseNames : undefined,
    raiseOnError,
  };
};

export const buildTestSuiteIngestionPayload = (
  data: TestSuiteIngestionDataType,
  {
    testSuiteId,
    nameFqn,
    entityFqn,
  }: {
    testSuiteId: string;
    // FQN whose last part names the pipeline when the user leaves Name empty.
    nameFqn: string;
    // The table under test; undefined for a logical suite.
    entityFqn?: string;
  }
): CreateIngestionPipeline => {
  const tableName = replaceAllSpacialCharWith_(getNameFromFQN(nameFqn));

  return {
    airflowConfig: {
      scheduleInterval: data.cron,
    },
    displayName:
      data.name || getIngestionName(tableName, PipelineType.TestSuite),
    name: generateUUID(),
    loggerLevel: data.enableDebugLog ? LogLevels.Debug : LogLevels.Info,
    pipelineType: PipelineType.TestSuite,
    raiseOnError: data.raiseOnError ?? true,
    service: {
      id: testSuiteId,
      type: camelCase(PipelineType.TestSuite),
    },
    sourceConfig: {
      config: {
        type: ConfigType.TestSuite,
        entityFullyQualifiedName: entityFqn,
        testCases: data.testCases,
      },
    },
  };
};

export interface TestSuitePipelineScope {
  testSuiteId: string;
  /** The table under test; undefined for a logical (bundle) suite. */
  tableFqn?: string;
  /** FQN whose last part names the pipeline when Name is left empty. */
  nameFqn: string;
}

/**
 * Resolves which suite a pipeline belongs to and which table it tests, from
 * whichever the host knows: the table (its basic suite), the suite itself, or
 * the pipeline being edited.
 */
export const getTestSuitePipelineScope = ({
  table,
  testSuite,
  ingestionPipeline,
}: {
  table?: Table;
  testSuite?: TestSuite | EntityReference;
  ingestionPipeline?: IngestionPipeline;
}): TestSuitePipelineScope => {
  const basicSuite = testSuite as TestSuite | undefined;
  const tableFqn =
    table?.fullyQualifiedName ??
    ingestionPipeline?.sourceConfig.config?.entityFullyQualifiedName ??
    (basicSuite?.basic
      ? basicSuite.basicEntityReference?.fullyQualifiedName
      : undefined);

  return {
    testSuiteId:
      table?.testSuite?.id ??
      testSuite?.id ??
      ingestionPipeline?.service?.id ??
      '',
    tableFqn,
    nameFqn: tableFqn ?? testSuite?.fullyQualifiedName ?? '',
  };
};

/** Form values for a new pipeline, or the pipeline being edited. */
export const getTestSuitePipelineFormDefaults = (
  ingestionPipeline: IngestionPipeline | undefined,
  defaultCron: string | undefined
): TestSuitePipelineFormValues => {
  if (!ingestionPipeline) {
    return {
      cron: defaultCron,
      enableDebugLog: false,
      raiseOnError: true,
      selectAllTestCases: false,
    };
  }
  const testCases = ingestionPipeline.sourceConfig.config?.testCases;

  return {
    cron: ingestionPipeline.airflowConfig.scheduleInterval,
    enableDebugLog: ingestionPipeline.loggerLevel === LogLevels.Debug,
    name: ingestionPipeline.displayName,
    raiseOnError: ingestionPipeline.raiseOnError ?? true,
    // A pipeline without a test case list runs every test case of the suite.
    selectAllTestCases: isUndefined(testCases),
    testCases,
  };
};

export const buildTestSuiteIngestionPatch = (
  ingestionPipeline: IngestionPipeline,
  data: TestSuiteIngestionDataType
): Operation[] =>
  compare(ingestionPipeline, {
    ...ingestionPipeline,
    displayName: data.name || ingestionPipeline.displayName,
    airflowConfig: {
      ...ingestionPipeline.airflowConfig,
      scheduleInterval: data.cron,
    },
    raiseOnError: data.raiseOnError ?? true,
    loggerLevel: data.enableDebugLog ? LogLevels.Debug : LogLevels.Info,
    sourceConfig: {
      ...ingestionPipeline.sourceConfig,
      config: {
        ...ingestionPipeline.sourceConfig.config,
        testCases: data.testCases,
      },
    },
  });
