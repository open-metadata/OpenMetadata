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

import { Skeleton, Table } from '@openmetadata/ui-core-components';
import { Button, Space, Switch, Tooltip, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { ProviderType } from '../../../generated/entity/bot';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { isExternalTestDefinition } from '../../../utils/TestDefinitionUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import { TestDefinitionTableProps } from './TestDefinitionTable.interface';

/**
 * Pure, props-driven untitled-ui table for the Test Definition listing. Shared
 * by the OSS classic page and the AI-mode page; all data/state lives in
 * useTestDefinitionListPage and is passed in.
 */
const TestDefinitionTable = ({
  testDefinitions,
  isLoading,
  pagingData,
  showPagination,
  testDefinitionPermissions,
  permissionLoading,
  onEnableToggle,
  onEdit,
  onDelete,
}: TestDefinitionTableProps) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      { id: 'name', label: t('label.name'), className: 'tw:w-[30%]' },
      {
        id: 'description',
        label: t('label.description'),
        className: 'tw:w-[38%]',
      },
      {
        id: 'entityType',
        label: t('label.entity-type'),
        className: 'tw:w-[12%]',
      },
      {
        id: 'testPlatforms',
        label: t('label.test-platform-plural'),
        className: 'tw:w-[12%]',
      },
      { id: 'enabled', label: t('label.enabled'), className: 'tw:w-[5%]' },
      {
        id: 'actions',
        label: t('label.action-plural'),
        className: 'tw:w-[3%]',
      },
    ],
    [t]
  );

  const loadingSkeletons = useMemo(
    () => (
      <div className="tw:p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton className="tw:mb-2" height={40} key={i} width="100%" />
        ))}
      </div>
    ),
    []
  );

  const renderEnabledCell = (record: TestDefinition) => {
    const entityPermissions = testDefinitionPermissions[record.name];
    const hasEditPermission = entityPermissions?.[Operation.EditAll];
    const isExternal = isExternalTestDefinition(record);

    if (permissionLoading || !entityPermissions) {
      return <Skeleton height={24} variant="rectangular" width={32} />;
    }

    let tooltipTitle;
    if (isExternal) {
      tooltipTitle = t('message.external-test-cannot-be-toggled');
    } else if (!hasEditPermission) {
      tooltipTitle = t('message.no-permission-for-action');
    }

    return (
      <Tooltip title={tooltipTitle}>
        <div className="new-form-style d-inline-flex">
          <Switch
            checked={record.enabled ?? true}
            data-testid={`enable-switch-${record.name}`}
            disabled={isExternal || !hasEditPermission}
            size="small"
            onChange={(checked) => onEnableToggle(record, checked)}
          />
        </div>
      </Tooltip>
    );
  };

  const renderActionsCell = (record: TestDefinition) => {
    const isSystemProvider = record.provider === ProviderType.System;
    const entityPermissions = testDefinitionPermissions[record.name];
    const hasEditPermission = entityPermissions?.[Operation.EditAll];
    const hasDeletePermission = entityPermissions?.[Operation.Delete];

    if (permissionLoading || !entityPermissions) {
      return <Skeleton height={24} variant="rectangular" width={24} />;
    }

    let editTooltip;
    if (isSystemProvider) {
      editTooltip = t('message.system-test-definition-edit-warning');
    } else if (hasEditPermission) {
      editTooltip = t('label.edit');
    } else {
      editTooltip = t('message.no-permission-for-action');
    }

    let deleteTooltip;
    if (isSystemProvider) {
      deleteTooltip = t('message.system-test-definition-delete-warning');
    } else if (hasDeletePermission) {
      deleteTooltip = t('label.delete');
    } else {
      deleteTooltip = t('message.no-permission-for-action');
    }

    return (
      <Space size={0}>
        <Tooltip title={editTooltip}>
          <Button
            data-testid={`edit-test-definition-${record.name}`}
            disabled={isSystemProvider || !hasEditPermission}
            icon={<IconEdit height={16} width={16} />}
            type="text"
            onClick={() => onEdit(record)}
          />
        </Tooltip>

        <Tooltip title={deleteTooltip}>
          <Button
            data-testid={`delete-test-definition-${record.name}`}
            disabled={isSystemProvider || !hasDeletePermission}
            icon={<IconDelete height={16} width={16} />}
            type="text"
            onClick={() => onDelete(record)}
          />
        </Tooltip>
      </Space>
    );
  };

  const renderRow = (record: TestDefinition) => (
    <Table.Row id={record.id ?? ''} key={record.id}>
      <Table.Cell>
        <Typography.Text data-testid={record.name}>
          {getEntityName(record)}
        </Typography.Text>
      </Table.Cell>
      <Table.Cell>
        <RichTextEditorPreviewerNew markdown={record.description ?? ''} />
      </Table.Cell>
      <Table.Cell>
        <Typography.Text>{record.entityType}</Typography.Text>
      </Table.Cell>
      <Table.Cell>
        <Typography.Text>
          {record.testPlatforms?.join(', ') ?? '--'}
        </Typography.Text>
      </Table.Cell>
      <Table.Cell>{renderEnabledCell(record)}</Table.Cell>
      <Table.Cell>{renderActionsCell(record)}</Table.Cell>
    </Table.Row>
  );

  return (
    <>
      <Table
        aria-label={t('label.data-quality-rule-plural')}
        data-testid="test-definition-table"
        size="sm">
        <Table.Header columns={columns}>
          {(col) => (
            <Table.Head
              className={col.className}
              id={col.id}
              key={col.id}
              label={col.label}
            />
          )}
        </Table.Header>
        <Table.Body
          dependencies={[
            testDefinitionPermissions,
            permissionLoading,
            testDefinitions,
          ]}
          items={isLoading ? [] : testDefinitions}
          renderEmptyState={() =>
            isLoading ? (
              loadingSkeletons
            ) : (
              <ErrorPlaceHolder
                className="p-y-lg"
                type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
              />
            )
          }>
          {(record) => renderRow(record)}
        </Table.Body>
      </Table>
      {showPagination && <NextPrevious {...pagingData} />}
    </>
  );
};

export default TestDefinitionTable;
