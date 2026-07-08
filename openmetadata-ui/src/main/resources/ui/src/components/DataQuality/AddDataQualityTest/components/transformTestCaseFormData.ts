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

import { FormSelectItem } from '@openmetadata/ui-core-components';
import { isArray, isEmpty, pick } from 'lodash';
import { TABLE_DIFF } from '../../../../constants/TestSuite.constant';
import {
  CreateIngestionPipeline,
  FluffyType as ConfigType,
  PipelineType,
} from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { CreateTestCase } from '../../../../generated/api/tests/createTestCase';
import { Table } from '../../../../generated/entity/data/table';
import { LogLevels } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../../../generated/tests/testCase';
import {
  TestCaseParameterDefinition,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { TagLabel } from '../../../../generated/type/tagLabel';
import testCaseClassBase from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import { getColumnNameFromEntityLink } from '../../../../utils/EntityPureUtils';
import { getEntityFQN } from '../../../../utils/FeedUtilsPure';
import {
  getParamPrefillKind,
  normalizeParamsForPayload,
  sanitizeParamName,
  unwrapSelectValue,
  unwrapSelectValues,
} from '../../../../utils/ParameterForm/ParameterFieldsUtils';
import { getIngestionName } from '../../../../utils/ServicePureUtils';
import {
  generateUUID,
  isValidJSONString,
  replaceAllSpacialCharWith_,
} from '../../../../utils/StringUtils';
import {
  generateEntityLink,
  getTagsWithoutTier,
} from '../../../../utils/TablePureUtils';
import { getFilterTags } from '../../../../utils/TableTags/TableTags.utils';
import { normalizeSelectedTestProp } from '../../AddTestCaseList/AddTestCaseListForm.utils';
import { TestCaseFormType } from '../AddDataQualityTest.interface';
import {
  KEY_COLUMNS,
  TABLE2,
  TABLE2_KEY_COLUMNS,
  USE_COLUMNS,
} from './TableDiffFields';
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
    values.pipelineName || getIngestionName(tableName, PipelineType.TestSuite);

  return {
    airflowConfig: {
      scheduleInterval: values.cron || undefined,
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

/**
 * `FormValues.params` is typed too narrowly for edit prefill (no `boolean`
 * param values, no `FormSelectItem`-shaped rows). This widens just the field
 * `buildEditDefaults` needs without touching the shared `FormValues`
 * interface, which other, later tasks own.
 */
type EditParamValue =
  | string
  | boolean
  | FormSelectItem
  | { value: string }[]
  | { value: FormSelectItem }[];

type EditFormValues = Omit<Partial<FormValues>, 'params'> & {
  params?: Record<string, EditParamValue>;
};

/**
 * tableDiff param names whose `ColumnArrayField` row renders a `SELECT`
 * field (`FieldTypes.SELECT`), which stores the row value as a
 * `FormSelectItem`, not a raw string — see `TableDiffFields.tsx`.
 */
const TABLE_DIFF_COLUMN_ARRAY_PARAMS = new Set([
  KEY_COLUMNS,
  TABLE2_KEY_COLUMNS,
  USE_COLUMNS,
]);

const toColumnFormSelectItem = (columnName: string): FormSelectItem => ({
  id: columnName,
  label: columnName,
});

/**
 * Builds the RHF value for a single Array-typed param from its JSON-array
 * payload string. tableDiff's `ColumnArrayField` params store each row as
 * `{ value: FormSelectItem }`; every other Array param's row is a plain-text
 * field storing `{ value: string }` — see `TableDiffFields.tsx` vs
 * `ParameterFields.tsx#ParamArrayField`.
 */
const buildEditArrayParamValue = (
  paramName: string,
  jsonValue: string,
  isTableDiff: boolean
): { value: string }[] | { value: FormSelectItem }[] | string => {
  const parsed = JSON.parse(jsonValue || '[]');
  let result: { value: string }[] | { value: FormSelectItem }[] | string;

  if (!isArray(parsed)) {
    result = parsed;
  } else if (isTableDiff && TABLE_DIFF_COLUMN_ARRAY_PARAMS.has(paramName)) {
    result = parsed.map((columnName: string) => ({
      value: toColumnFormSelectItem(columnName),
    }));
  } else {
    result = parsed.map((value: string) => ({ value }));
  }

  return result;
};

/**
 * Builds a single param's RHF value from its `parameterValues` entry, keyed
 * by the param's sanitized name (dots replaced, since RHF field paths can't
 * contain dots — see `sanitizeParamName`).
 *
 * tableDiff's own fields (`table2`, `keyColumns`, `table2.keyColumns`,
 * `useColumns`, handled by `TableDiffFields.tsx`) are checked first since
 * they don't go through `ParameterFields`'s generic per-dataType rendering.
 * Every other param's shape is derived from `getParamPrefillKind`, the same
 * classifier `ParameterFields.tsx` render logic is built on (via
 * `isSelectParam`) — so the two can't drift out of sync.
 */
const buildEditParamEntry = (
  curr: { name?: string; value?: string },
  param: TestCaseParameterDefinition | undefined,
  definition: TestDefinition,
  isTableDiff: boolean
): EditParamValue => {
  let result: EditParamValue;

  if (isTableDiff && curr.name === TABLE2) {
    result = curr.value ? toColumnFormSelectItem(curr.value) : '';
  } else {
    const kind = getParamPrefillKind(definition, param);
    switch (kind) {
      case 'select':
        result = curr.value ? toColumnFormSelectItem(curr.value) : '';

        break;
      case 'array':
        result = isValidJSONString(curr.value)
          ? buildEditArrayParamValue(
              curr.name ?? '',
              curr.value ?? '[]',
              isTableDiff
            )
          : curr.value ?? '';

        break;
      case 'boolean':
        result = curr.value === 'true';

        break;
      default:
        result = curr.value ?? '';
    }
  }

  return result;
};

/**
 * Builds the `params` RHF value from a TestCase's `parameterValues`, keyed by
 * sanitized param name. Mirrors the legacy `EditTestCaseModalV1.getParamsValue`
 * for scalar/boolean params, but produces the `FormSelectItem`-based shapes
 * the RHF `TableDiffFields`/`ParameterFields` select and column-array fields
 * actually read (see `ParameterFieldsUtils.normalizeParamsForPayload`, which
 * reverses this on submit).
 */
const buildEditParams = (
  testCase: TestCase,
  definition: TestDefinition
): Record<string, EditParamValue> => {
  const isTableDiff = definition.fullyQualifiedName === TABLE_DIFF;
  const result: Record<string, EditParamValue> = {};
  (testCase.parameterValues ?? []).forEach((curr) => {
    const param = definition.parameterDefinition?.find(
      (paramDefinition) => paramDefinition.name === curr.name
    );
    const key = sanitizeParamName(curr.name || '');

    result[key] = buildEditParamEntry(curr, param, definition, isTableDiff);
  });

  return result;
};

/**
 * Splits a TestCase's tags into `tags` (Classification) and `glossaryTerms`
 * (Glossary), excluding the Tier tag — mirrors the legacy
 * `EditTestCaseModalV1` tags/glossaryTerms memo.
 */
const buildEditTagFields = (
  testCase: TestCase
): Pick<FormValues, 'tags' | 'glossaryTerms'> => {
  if (isEmpty(testCase.tags)) {
    return { tags: [], glossaryTerms: [] };
  }

  const tagsWithoutTier = getTagsWithoutTier(testCase.tags as TagLabel[]);
  const filteredTags = getFilterTags(tagsWithoutTier);

  return {
    tags: filteredTags.Classification,
    glossaryTerms: filteredTags.Glossary,
  };
};

const buildEditTestLevel = (testCase: TestCase): TestLevel => {
  const isColumnLevel = Boolean(testCase.entityLink?.includes('::columns::'));
  let result = TestLevel.TABLE;
  if (isColumnLevel) {
    result = isEmpty(testCase.dimensionColumns)
      ? TestLevel.COLUMN
      : TestLevel.COLUMN_DIMENSION;
  }

  return result;
};

/**
 * Builds react-hook-form default values from an existing `TestCase`, for
 * prefilling the shared test-case form in edit mode.
 */
export const buildEditDefaults = (
  testCase: TestCase,
  definition: TestDefinition
): EditFormValues => {
  const tableFqn = getEntityFQN(testCase.entityLink ?? '');
  const selectedColumn = getColumnNameFromEntityLink(testCase.entityLink ?? '');

  const scalarFields: Pick<
    EditFormValues,
    | 'displayName'
    | 'description'
    | 'computePassedFailedRowCount'
    | 'useDynamicAssertion'
    | 'dimensionColumns'
    | 'topDimensions'
  > = pick(testCase, [
    'displayName',
    'description',
    'computePassedFailedRowCount',
    'useDynamicAssertion',
    'dimensionColumns',
    'topDimensions',
  ]);

  return {
    testLevel: buildEditTestLevel(testCase),
    testName: testCase.name,
    selectedTable: { id: tableFqn, label: tableFqn } as never,
    selectedColumn: selectedColumn || undefined,
    testTypeId: {
      id: testCase.testDefinition?.fullyQualifiedName ?? '',
      label: testCase.testDefinition?.fullyQualifiedName ?? '',
    } as never,
    params: buildEditParams(testCase, definition),
    ...buildEditTagFields(testCase),
    ...scalarFields,
  };
};
