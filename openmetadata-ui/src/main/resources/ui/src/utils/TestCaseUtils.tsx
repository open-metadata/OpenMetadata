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

import { Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { lowerCase } from 'lodash';
import { unparse, type UnparseObject } from 'papaparse';
import type { ReactElement, ReactNode } from 'react';
import { NavigateFunction } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../assets/svg/edit-new.svg';
import { ReactComponent as ExportIcon } from '../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../assets/svg/ic-import.svg';
import { ManageButtonItemLabel } from '../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { ManageMenuItem } from '../components/common/ManageMenuButton/ManageMenuButton.component';
import { ExportData } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { ExportTypes } from '../constants/Export.constants';
import { EntityType } from '../enums/entity.enum';
import { TestCaseStatus } from '../generated/entity/feed/thread';
import type { TestCase } from '../generated/tests/testCase';
import { TagSource } from '../generated/type/tagLabel';
import LimitWrapper from '../hoc/LimitWrapper';
import { exportTestCasesInCSV } from '../rest/testAPI';
import { getEntityBulkEditPath, getEntityImportPath } from './EntityPureUtils';
import { getEntityColumnFQN, getEntityFQN } from './FeedUtilsPure';
import { t } from './i18next/LocalUtil';

export const getTestCaseResultCount = (
  count: number,
  status: TestCaseStatus
): ReactNode => (
  <div
    className={`test-result-container ${lowerCase(status)}`}
    data-testid={`test-${status}`}>
    <Typography.Text
      className="font-medium text-md"
      data-testid={`test-${status}-value`}>
      {count}
    </Typography.Text>
  </div>
);

interface TestCasePermission {
  ViewAll: boolean;
  EditAll: boolean;
}

const TEST_CASE_CSV_HEADERS = [
  'name',
  'displayName',
  'description',
  'testDefinition',
  'entityFQN',
  'testSuite',
  'parameterValues',
  'computePassedFailedRowCount',
  'useDynamicAssertion',
  'inspectionQuery',
  'tags',
  'glossaryTerms',
];

const unparseTestCaseCsv = (
  data: UnparseObject<Record<string, string>>
): string => unparse(data, { escapeFormulae: true });

/**
 * Serializes client-fetched filtered results with the import-compatible test
 * case schema. The async server export accepts an FQN but not list filters.
 */
export const convertTestCasesToCSV = (testCases: TestCase[]): string =>
  unparseTestCaseCsv({
    fields: TEST_CASE_CSV_HEADERS,
    data: testCases.map((testCase) => ({
      name: testCase.name,
      displayName: testCase.displayName ?? '',
      description: testCase.description ?? '',
      testDefinition:
        testCase.testDefinition?.fullyQualifiedName ??
        testCase.testDefinition?.name ??
        '',
      entityFQN:
        testCase.entityFQN ??
        (testCase.entityLink?.includes('::columns::')
          ? getEntityColumnFQN(testCase.entityLink)
          : getEntityFQN(testCase.entityLink ?? '')),
      testSuite:
        testCase.testSuite?.fullyQualifiedName ??
        testCase.testSuite?.name ??
        '',
      parameterValues:
        testCase.parameterValues
          ?.map((value) => JSON.stringify(value))
          .join(';') ?? '',
      computePassedFailedRowCount:
        testCase.computePassedFailedRowCount?.toString() ?? '',
      useDynamicAssertion: testCase.useDynamicAssertion?.toString() ?? '',
      inspectionQuery: testCase.inspectionQuery ?? '',
      tags:
        testCase.tags
          ?.filter((tag) => tag.source === TagSource.Classification)
          .map((tag) => tag.tagFQN)
          .join(';') ?? '',
      glossaryTerms:
        testCase.tags
          ?.filter((tag) => tag.source === TagSource.Glossary)
          .map((tag) => tag.tagFQN)
          .join(';') ?? '',
    })),
  });

export const getTestCaseManageMenuItems = (
  fqn: string,
  permission: TestCasePermission,
  deleted: boolean,
  navigate: NavigateFunction,
  showModal: (data: ExportData) => void,
  sourceEntityType?: EntityType.TABLE | EntityType.TEST_SUITE,
  // Entity pages use the server export by default; the filtered list injects
  // a client-side exporter that preserves its current search and filters.
  onExport: ExportData['onExport'] = exportTestCasesInCSV
): ManageMenuItem[] => {
  const { ViewAll, EditAll } = permission;

  const allowEdit = EditAll && !deleted;
  const allowView = ViewAll && !deleted;
  const withLimit = (node: ReactElement) => (
    <LimitWrapper resource="testCase">{node}</LimitWrapper>
  );
  const withSource = (path: string) =>
    sourceEntityType ? `${path}?sourceEntityType=${sourceEntityType}` : path;

  return [
    ...(allowEdit
      ? [
          {
            key: 'import-button',
            icon: ImportIcon,
            title: t('label.import'),
            description: t('message.import-entity-help', {
              entity: t('label.test-case-lowercase-plural'),
            }),
            wrapper: withLimit,
            onClick: () =>
              navigate(
                withSource(getEntityImportPath(EntityType.TEST_CASE, fqn))
              ),
          },
        ]
      : []),
    ...(allowView
      ? [
          {
            key: 'export-button',
            icon: ExportIcon,
            title: t('label.export'),
            description: t('message.export-entity-help', {
              entity: t('label.test-case-lowercase-plural'),
            }),
            onClick: () =>
              showModal({
                name: fqn,
                onExport,
                exportTypes: [ExportTypes.CSV],
              }),
          },
        ]
      : []),
    ...(allowEdit
      ? [
          {
            key: 'bulk-edit-button',
            icon: IconEdit,
            title: t('label.bulk-edit'),
            description: t('message.bulk-edit-entity-help', {
              entity: t('label.test-case-lowercase-plural'),
            }),
            wrapper: withLimit,
            onClick: () =>
              navigate(
                withSource(getEntityBulkEditPath(EntityType.TEST_CASE, fqn))
              ),
          },
        ]
      : []),
  ];
};

export const ExtraTestCaseDropdownOptions = (
  fqn: string,
  permission: TestCasePermission,
  deleted: boolean,
  navigate: NavigateFunction,
  showModal: (data: ExportData) => void,
  sourceEntityType?: EntityType.TABLE | EntityType.TEST_SUITE
): ItemType[] =>
  getTestCaseManageMenuItems(
    fqn,
    permission,
    deleted,
    navigate,
    showModal,
    sourceEntityType
  ).map((item) => {
    const label = (
      <ManageButtonItemLabel
        description={item.description ?? ''}
        icon={item.icon}
        id={item.key}
        name={item.title}
        onClick={item.onClick}
      />
    );

    return {
      key: item.key,
      label: item.wrapper ? item.wrapper(label) : label,
    };
  });
