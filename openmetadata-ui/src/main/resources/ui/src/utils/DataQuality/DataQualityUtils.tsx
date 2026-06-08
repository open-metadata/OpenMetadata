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
import { t } from 'i18next';
import { ReactComponent as ColumnIcon } from '../../assets/svg/ic-column.svg';
import { ReactComponent as TableIcon } from '../../assets/svg/ic-table-test.svg';
import type { SelectionOption } from '../../components/common/SelectionCardGroup/SelectionCardGroup.interface';
import { TEXT_GREY_MUTED } from '../../constants/constants';
import { TestCaseType } from '../../enums/TestSuite.enum';

export const TEST_LEVEL_OPTIONS: SelectionOption[] = [
  {
    value: TestCaseType.table,
    label: t('label.table-level'),
    description: t('label.test-applied-on-entity', {
      entity: t('label.table-lowercase'),
    }),
    icon: <TableIcon />,
  },
  {
    value: TestCaseType.column,
    label: t('label.column-level'),
    description: t('label.test-applied-on-entity', {
      entity: t('label.column-lowercase'),
    }),
    icon: <ColumnIcon />,
  },
];

export const getPieChartLabel = (label: string, value = 0) => {
  return (
    <>
      <text
        dy={8}
        fill="#1D2939"
        fontSize={20}
        fontWeight={600}
        textAnchor="middle"
        x="50%"
        y="56%">
        {value}
      </text>
      <text
        dy={8}
        fill={TEXT_GREY_MUTED}
        fontSize={12}
        fontWeight={500}
        textAnchor="middle"
        x="50%"
        y="44%">
        {label}
      </text>
    </>
  );
};

// Re-exports from DataQualityPureUtils (backward compat)
export {
  aggregateTestResultsByEntity,
  buildDataQualityDashboardFilters,
  buildMustEsFilterForDataProducts,
  buildMustEsFilterForOwner,
  buildMustEsFilterForTags,
  buildMustEsFilterForTier,
  buildTestCaseParams,
  calculateTestCaseStatusCounts,
  COLUMN_AGGREGATE_FIELD,
  convertSearchSourceToTable,
  createTestCaseParameters,
  createUpdatedTestCasePatch,
  filterTestCasesByTableAndColumn,
  getColumnFilterEntityLink,
  getColumnFilterOptions,
  getColumnNameFromColumnFilterKey,
  getDimensionIcon,
  getEntityLinkForColumnFilter,
  getSelectedOptionsFromKeys,
  getServiceTypeForTestDefinition,
  getTestCaseFiltersValue,
  getTestCaseTabPath,
  parseColumnAggregateBuckets,
  transformToTestCaseStatusByDimension,
  transformToTestCaseStatusObject,
} from './DataQualityPureUtils';
export type {
  CreateUpdatedTestCasePatchArgs,
  TestCaseCountByStatus,
} from './DataQualityPureUtils';
