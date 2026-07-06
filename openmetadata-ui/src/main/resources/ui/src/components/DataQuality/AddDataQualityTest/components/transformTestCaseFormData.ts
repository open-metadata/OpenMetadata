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

import { isEmpty } from 'lodash';
import {
  CreateIngestionPipeline,
  FluffyType as ConfigType,
  PipelineType,
} from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { CreateTestCase } from '../../../../generated/api/tests/createTestCase';
import { Table } from '../../../../generated/entity/data/table';
import { LogLevels } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { TagLabel } from '../../../../generated/type/tagLabel';
import testCaseClassBase from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import {
  normalizeParamsForPayload,
  unwrapSelectValue,
  unwrapSelectValues,
} from '../../../../utils/ParameterForm/ParameterFieldsUtils';
import { getIngestionName } from '../../../../utils/ServicePureUtils';
import {
  generateUUID,
  replaceAllSpacialCharWith_,
} from '../../../../utils/StringUtils';
import { generateEntityLink } from '../../../../utils/TablePureUtils';
import { normalizeSelectedTestProp } from '../../AddTestCaseList/AddTestCaseListForm.utils';
import { TestCaseFormType } from '../AddDataQualityTest.interface';
import { FormValues, TestLevel } from './TestCaseFormV1.interface';

export interface TestCaseTransformContext {
  selectedDefinition?: TestDefinition;
  selectedTableData?: Table;
  selectedColumn?: string;
  selectedTestLevel: TestLevel;
  selectedTable?: string;
  table?: Table;
  generateName?: () => string;
}

export interface PipelinePayloadContext {
  testSuite: TestSuite;
  createdTestCaseName: string;
  selectedTable?: string;
  table?: Table;
}

const isTagLabel = (value: unknown): value is TagLabel =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { tagFQN?: unknown }).tagFQN === 'string';

/**
 * Tag/glossary fields may store either ready-made `TagLabel` objects or
 * `FormSelectItem` (`{ id, label }`) entries depending on how the suggestion
 * field is wired. This collapses both into `CreateTestCase.tags`-compatible
 * `TagLabel`s — passing real `TagLabel`s through untouched and lifting a
 * `FormSelectItem` id into a minimal `TagLabel`.
 */
const normalizeTagLabels = (values: unknown[] | undefined): TagLabel[] => {
  const result: TagLabel[] = [];
  (values ?? []).forEach((value) => {
    if (isTagLabel(value)) {
      result.push(value);
    } else {
      const tagFQN = unwrapSelectValue(value);
      if (tagFQN) {
        result.push({ tagFQN } as TagLabel);
      }
    }
  });

  return result;
};

/**
 * Builds a CreateTestCase payload from form values and resolved context.
 * Extracted from TestCaseFormV1.createTestCaseObj — no React, no network calls.
 */
export const transformTestCaseFormData = (
  values: FormValues,
  ctx: TestCaseTransformContext
): CreateTestCase => {
  const columnName = ctx.selectedColumn;

  const name = values.testName?.trim() || ctx.generateName?.() || '';

  const entityFqn =
    ctx.selectedTableData?.fullyQualifiedName ||
    ctx.selectedTable ||
    ctx.table?.fullyQualifiedName ||
    '';

  const isColumnLevel = ctx.selectedTestLevel === TestLevel.COLUMN;

  const entityLink = generateEntityLink(
    isColumnLevel ? `${entityFqn}.${columnName}` : entityFqn,
    isColumnLevel
  );

  const normalizedValues = {
    ...values,
    params: normalizeParamsForPayload(values.params, ctx.selectedDefinition),
  };

  return {
    name,
    displayName: name,
    computePassedFailedRowCount: values.computePassedFailedRowCount,
    entityLink,
    testDefinition: unwrapSelectValue(values.testTypeId) ?? '',
    dimensionColumns:
      values.testLevel === TestLevel.COLUMN_DIMENSION
        ? unwrapSelectValues(values.dimensionColumns)
        : undefined,
    topDimensions:
      values.testLevel === TestLevel.COLUMN_DIMENSION
        ? values.topDimensions
        : undefined,
    description: isEmpty(values.description) ? undefined : values.description,
    tags: [
      ...normalizeTagLabels(values.tags),
      ...normalizeTagLabels(values.glossaryTerms),
    ],
    ...testCaseClassBase.getCreateTestCaseObject(
      normalizedValues as TestCaseFormType,
      ctx.selectedDefinition
    ),
  };
};

/**
 * Builds a CreateIngestionPipeline payload from form values and resolved context.
 */
export const buildTestSuitePipelinePayload = (
  values: FormValues,
  ctx: PipelinePayloadContext
): CreateIngestionPipeline => {
  const selectedTestCases = normalizeSelectedTestProp(values.testCases);

  const tableName = replaceAllSpacialCharWith_(
    ctx.selectedTable ?? ctx.table?.fullyQualifiedName ?? ''
  );

  const updatedName =
    values.pipelineName ?? getIngestionName(tableName, PipelineType.TestSuite);

  return {
    airflowConfig: {
      scheduleInterval: values.cron,
    },
    displayName: updatedName,
    name: generateUUID(),
    loggerLevel: values.enableDebugLog ? LogLevels.Debug : LogLevels.Info,
    pipelineType: PipelineType.TestSuite,
    raiseOnError: values.raiseOnError ?? true,
    service: {
      id: ctx.testSuite.id ?? '',
      type: 'testSuite',
    },
    sourceConfig: {
      config: {
        type: ConfigType.TestSuite,
        entityFullyQualifiedName: ctx.testSuite.fullyQualifiedName,
        testCases:
          values.selectAllTestCases === false
            ? [ctx.createdTestCaseName, ...selectedTestCases]
            : undefined,
      },
    },
  };
};
