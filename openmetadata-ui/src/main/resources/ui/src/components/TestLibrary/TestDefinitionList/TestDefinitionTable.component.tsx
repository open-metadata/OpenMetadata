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

import {
  Box,
  EmptyPlaceholder,
  Skeleton,
  Table,
} from '@openmetadata/ui-core-components';
import { FileShield02 } from '@untitledui/icons';
import { Button, Space, Switch, Tooltip, Typography } from 'antd';
import { useCallback, useMemo } from 'react';
import { SortDescriptor } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as FilterOffIcon } from '../../../assets/svg/ic-filter-off.svg';
import { ProviderType } from '../../../generated/entity/bot';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { isExternalTestDefinition } from '../../../utils/TestDefinitionUtils';
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
  isInitialLoading,
  pagingData,
  showPagination,
  testDefinitionPermissions,
  permissionLoading,
  sortDescriptor,
  onSortChange,
  onEnableToggle,
  onEdit,
  onDelete,
  hasActiveFilters = false,
  onClearFilters,
}: TestDefinitionTableProps) => {
  const { t } = useTranslation();

  // react-aria reports the new descriptor; the listing state upstream is keyed
  // by column id and asc/desc, so translate here rather than teaching every
  // caller react-aria's vocabulary.
  const handleSortChange = useCallback(
    (descriptor: SortDescriptor) => {
      onSortChange(
        String(descriptor.column),
        descriptor.direction === 'descending' ? 'desc' : 'asc'
      );
    },
    [onSortChange]
  );

  const columns = useMemo(
    () => [
      {
        id: 'name',
        label: t('label.name'),
        className: 'tw:w-[30%]',
        allowsSorting: true,
      },
      {
        id: 'description',
        label: t('label.description'),
        className: 'tw:w-[38%]',
      },
      {
        id: 'entityType',
        label: t('label.entity-type'),
        className: 'tw:w-[12%]',
        allowsSorting: true,
      },
      {
        id: 'testPlatforms',
        label: t('label.test-platform-plural'),
        className: 'tw:w-[12%]',
        allowsSorting: true,
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
        {Array.from(
          { length: 5 },
          (_, i) => `test-definition-skeleton-${i}`
        ).map((skeletonKey) => (
          <Skeleton
            className="tw:mb-2"
            height={40}
            key={skeletonKey}
            width="100%"
          />
        ))}
      </div>
    ),
    []
  );

  // A refetch dims the rows in place instead of unmounting them. aria-busy is
  // what carries the state to a screen reader, since there is no longer a
  // visual placeholder saying the list is being replaced.
  //
  // The rows being kept are the PREVIOUS query's rows, so their controls are
  // held shut until the new ones land. Acting on one would patch a definition
  // the list has already moved on from, and the arriving response would
  // overwrite the toggle, showing a successful edit as if it had reverted.
  // Disabled rather than pointer-events-none so the controls also leave the
  // tab order instead of staying reachable but inert-looking.
  const isRefetching = isLoading && !isInitialLoading;

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
            disabled={isExternal || !hasEditPermission || isRefetching}
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
    if (!hasEditPermission) {
      editTooltip = t('message.no-permission-for-action');
    } else if (isSystemProvider) {
      // Everything else about a shipped test definition is fixed, so say what the form will
      // actually let them change rather than presenting a plain "Edit".
      editTooltip = t('message.system-test-definition-dimension-edit-only');
    } else {
      editTooltip = t('label.edit');
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
            disabled={!hasEditPermission || isRefetching}
            icon={<IconEdit height={16} width={16} />}
            type="text"
            onClick={() => onEdit(record)}
          />
        </Tooltip>

        <Tooltip title={deleteTooltip}>
          <Button
            data-testid={`delete-test-definition-${record.name}`}
            disabled={isSystemProvider || !hasDeletePermission || isRefetching}
            icon={<IconDelete height={16} width={16} />}
            type="text"
            onClick={() => onDelete(record)}
          />
        </Tooltip>
      </Space>
    );
  };

  const renderRow = (record: TestDefinition) => (
    <Table.Row id={record.id ?? record.name} key={record.id ?? record.name}>
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
      <div
        aria-busy={isLoading}
        className={
          isRefetching
            ? 'tw:opacity-60 tw:transition-opacity tw:duration-150'
            : 'tw:transition-opacity tw:duration-150'
        }
        data-testid="test-definition-table-container">
        <Table
          aria-label={t('label.data-quality-rule-plural')}
          data-testid="test-definition-table"
          size="sm"
          sortDescriptor={sortDescriptor}
          onSortChange={handleSortChange}>
          <Table.Header columns={columns}>
            {(col) => (
              <Table.Head
                allowsSorting={col.allowsSorting}
                className={col.className}
                id={col.id}
                isRowHeader={col.id === 'name'}
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
              // A refetch changes no row data, so without this the collection
              // serves the cached nodes and the controls keep the disabled
              // state they were built with - staying live for the whole
              // refetch they are supposed to sit out.
              isRefetching,
            ]}
            items={isInitialLoading ? [] : testDefinitions}
            renderEmptyState={() =>
              isInitialLoading ? (
                loadingSkeletons
              ) : (
                <Box className="tw:relative tw:min-h-80 tw:w-full">
                  <EmptyPlaceholder
                    actions={
                      hasActiveFilters && onClearFilters
                        ? [
                            {
                              key: 'clear-filters',
                              label: t('label.clear-filter-plural'),
                              color: 'primary' as const,
                              onPress: onClearFilters,
                            },
                          ]
                        : undefined
                    }
                    description={t(
                      hasActiveFilters
                        ? 'message.no-results-for-filters-description'
                        : 'message.no-test-definitions-yet-description'
                    )}
                    icon={
                      hasActiveFilters ? (
                        <FilterOffIcon className="tw:text-fg-quaternary" />
                      ) : (
                        <FileShield02 className="tw:text-fg-brand-primary" />
                      )
                    }
                    title={t(
                      hasActiveFilters
                        ? 'message.no-results-for-filters'
                        : 'message.no-test-definitions-yet'
                    )}
                    variant="blank"
                  />
                </Box>
              )
            }>
            {(record) => renderRow(record)}
          </Table.Body>
        </Table>
      </div>
      {showPagination && <NextPrevious {...pagingData} />}
    </>
  );
};

export default TestDefinitionTable;
