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

import {
  Button,
  Card,
  Col,
  Row,
  Skeleton,
  Space,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { ProviderType } from '../../../generated/entity/bot';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import {
  deleteTestDefinitionByFqn,
  getListTestDefinitions,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../../utils/PermissionsUtils';
import { isExternalTestDefinition } from '../../../utils/TestDefinitionUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../common/Table/Table';
import { LearningIcon } from '../../Learning/LearningIcon/LearningIcon.component';
import EntityDeleteModal from '../../Modals/EntityDeleteModal/EntityDeleteModal';
import TestDefinitionForm from '../TestDefinitionForm/TestDefinitionForm.component';

const TestDefinitionList = () => {
  const { t } = useTranslation();
  const { permissions, getEntityPermissionByFqn } = usePermissionProvider();
  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
    pagingCursor,
  } = usePaging();

  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDefinition, setSelectedDefinition] = useState<
    TestDefinition | undefined
  >();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [definitionToDelete, setDefinitionToDelete] = useState<
    TestDefinition | undefined
  >();
  const [testDefinitionPermissions, setTestDefinitionPermissions] = useState<
    Record<string, OperationPermission>
  >({});
  const [permissionLoading, setPermissionLoading] = useState(true);

  const createPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.TEST_DEFINITION,
        permissions
      ),
    [permissions]
  );

  const viewPermission = useMemo(
    () =>
      checkPermission(
        Operation.ViewBasic,
        ResourceEntity.TEST_DEFINITION,
        permissions
      ) ||
      checkPermission(
        Operation.ViewAll,
        ResourceEntity.TEST_DEFINITION,
        permissions
      ),
    [permissions]
  );

  const fetchTestDefinitionPermissions = useCallback(
    async (definitions: TestDefinition[]) => {
      try {
        setPermissionLoading(true);

        if (!definitions.length) {
          setTestDefinitionPermissions({});

          return;
        }

        // Fetch permissions for all definitions (including system definitions)
        const permissionPromises: Promise<OperationPermission>[] =
          definitions.map((def) =>
            getEntityPermissionByFqn(
              ResourceEntity.TEST_DEFINITION,
              def.fullyQualifiedName ?? ''
            )
          );

        const permissionResponses = await Promise.allSettled(
          permissionPromises
        );

        const permissionsMap = definitions.reduce((acc, def, idx) => {
          const response = permissionResponses[idx];

          return {
            ...acc,
            [def.name]:
              response?.status === 'fulfilled'
                ? response.value
                : DEFAULT_ENTITY_PERMISSION,
          };
        }, {} as Record<string, OperationPermission>);

        setTestDefinitionPermissions(permissionsMap);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setPermissionLoading(false);
      }
    },
    [getEntityPermissionByFqn]
  );

  const fetchTestDefinitions = useCallback(
    async (pagingOffset?: Partial<Paging>) => {
      setIsLoading(true);
      try {
        const { data, paging: responsePaging } = await getListTestDefinitions({
          after: pagingOffset?.after,
          before: pagingOffset?.before,
          limit: pageSize,
        });
        setTestDefinitions(data);
        handlePagingChange(responsePaging);
        // Fetch permissions asynchronously to avoid blocking list render
        fetchTestDefinitionPermissions(data);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, handlePagingChange, fetchTestDefinitionPermissions]
  );

  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchTestDefinitions({ [cursorType]: cursorValue });
    } else {
      fetchTestDefinitions();
    }
  }, [pageSize, pagingCursor]);

  const handleEnableToggle = async (
    record: TestDefinition,
    checked: boolean
  ) => {
    try {
      const updatedData = { ...record, enabled: checked };
      const patch = compare(record, updatedData);

      await patchTestDefinition(record.id ?? '', patch);
      showSuccessToast(
        t('server.entity-updated-success', {
          entity: t('label.test-definition'),
        })
      );
      // Optimistically update the local state instead of re-fetching
      setTestDefinitions((prev) =>
        prev.map((item) =>
          item.id === record.id
            ? {
                ...item,
                enabled: checked,
              }
            : item
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleEdit = (record: TestDefinition) => {
    setSelectedDefinition(record);
    setIsFormVisible(true);
  };

  const handleDeleteClick = (record: TestDefinition) => {
    setDefinitionToDelete(record);
    setIsDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!definitionToDelete) {
      return;
    }

    try {
      await deleteTestDefinitionByFqn(
        definitionToDelete.fullyQualifiedName ?? ''
      );
      showSuccessToast(
        t('server.entity-deleted-success', {
          entity: t('label.test-definition'),
        })
      );
      setIsDeleteModalVisible(false);
      setDefinitionToDelete(undefined);
      // Reset pagination to page 1: handlePageChange synchronously updates URL params,
      // and fetchTestDefinitions reads from usePaging state which syncs with URL.
      // This ensures the list refreshes at page 1 with no cursor.
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
      fetchTestDefinitions();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalVisible(false);
    setDefinitionToDelete(undefined);
  };

  const handleFormSuccess = (data?: TestDefinition) => {
    setIsFormVisible(false);
    if (selectedDefinition && data) {
      setTestDefinitions((prev) =>
        prev.map((item) => (item.id === data.id ? data : item))
      );
    } else {
      // New item created: reset to page 1 to show the new item
      // (same pattern as handleDeleteConfirm)
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
      fetchTestDefinitions();
    }
    setSelectedDefinition(undefined);
  };

  const handleFormCancel = () => {
    setIsFormVisible(false);
    setSelectedDefinition(undefined);
  };

  const columns: ColumnsType<TestDefinition> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: '30%',
        render: (name: string, record: TestDefinition) => (
          <Typography.Text data-testid={name}>
            {getEntityName(record)}
          </Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: '45%',
        ellipsis: true,
        render: (description: string) => (
          <RichTextEditorPreviewerNew markdown={description} />
        ),
      },
      {
        title: t('label.entity-type'),
        dataIndex: 'entityType',
        key: 'entityType',
        width: 150,
        render: (entityType: string) => (
          <Typography.Text>{entityType}</Typography.Text>
        ),
      },
      {
        title: t('label.test-platform-plural'),
        dataIndex: 'testPlatforms',
        key: 'testPlatforms',
        width: 200,
        render: (testPlatforms: string[]) => (
          <Typography.Text>{testPlatforms?.join(', ') ?? '--'}</Typography.Text>
        ),
      },
      {
        title: t('label.enabled'),
        dataIndex: 'enabled',
        key: 'enabled',
        width: 100,
        render: (enabled: boolean, record: TestDefinition) => {
          const entityPermissions = testDefinitionPermissions[record.name];
          const hasEditPermission = entityPermissions?.[Operation.EditAll];
          const isExternal = isExternalTestDefinition(record);

          if (permissionLoading || !entityPermissions) {
            return (
              <Skeleton.Button active size="small" style={{ width: 32 }} />
            );
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
                  checked={enabled ?? true}
                  data-testid={`enable-switch-${record.name}`}
                  disabled={isExternal || !hasEditPermission}
                  size="small"
                  onChange={(checked) => handleEnableToggle(record, checked)}
                />
              </div>
            </Tooltip>
          );
        },
      },
      {
        title: t('label.action-plural'),
        key: 'actions',
        width: 120,
        fixed: 'right',
        render: (_, record: TestDefinition) => {
          const isSystemProvider = record.provider === ProviderType.System;
          const entityPermissions = testDefinitionPermissions[record.name];
          const hasEditPermission = entityPermissions?.[Operation.EditAll];
          const hasDeletePermission = entityPermissions?.[Operation.Delete];

          if (permissionLoading || !entityPermissions) {
            return (
              <Skeleton.Button active size="small" style={{ width: 24 }} />
            );
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
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>

              <Tooltip title={deleteTooltip}>
                <Button
                  data-testid={`delete-test-definition-${record.name}`}
                  disabled={isSystemProvider || !hasDeletePermission}
                  icon={<IconDelete height={16} width={16} />}
                  type="text"
                  onClick={() => handleDeleteClick(record)}
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [t, testDefinitionPermissions]
  );

  const handlePageChangeCallback = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (cursorType && paging) {
      handlePageChange(
        currentPage,
        { cursorType, cursorValue: paging[cursorType] },
        pageSize
      );
    }
  };

  const customPaginationProps = useMemo(
    () => ({
      currentPage,
      pageSize,
      paging,
      pagingHandler: handlePageChangeCallback,
      showPagination,
      isLoading,
      onShowSizeChange: handlePageSizeChange,
    }),
    [
      currentPage,
      paging,
      pageSize,
      handlePageChange,
      handlePageSizeChange,
      showPagination,
      isLoading,
    ]
  );

  if (!viewPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <>
      <Row className="p-b-md" gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Row justify="space-between">
              <Col>
                <div className="flex gap-2 items-center m-b-xss">
                  <Typography.Title className="m-b-0" level={5}>
                    {t('label.data-quality-rule-plural')}
                  </Typography.Title>
                  <LearningIcon
                    pageId={LEARNING_PAGE_IDS.RULES_LIBRARY}
                    title={t('label.data-quality-rule-plural')}
                  />
                </div>
                <Typography.Text type="secondary">
                  {t('message.page-sub-header-for-test-definitions')}
                </Typography.Text>
              </Col>
              {createPermission && (
                <Col>
                  <Button
                    data-testid="add-test-definition-button"
                    type="primary"
                    onClick={() => setIsFormVisible(true)}>
                    {t('label.add-entity', {
                      entity: t('label.test-definition'),
                    })}
                  </Button>
                </Col>
              )}
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <Table
            bordered
            columns={columns}
            customPaginationProps={customPaginationProps}
            data-testid="test-definition-table"
            dataSource={testDefinitions}
            loading={isLoading}
            locale={{
              emptyText: !isLoading && (
                <ErrorPlaceHolder
                  className="p-y-lg"
                  type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            scroll={{ x: 1200 }}
            size="small"
          />
        </Col>
      </Row>

      {isFormVisible && (
        <TestDefinitionForm
          initialValues={selectedDefinition}
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
        />
      )}

      <EntityDeleteModal
        entityName={getEntityName(definitionToDelete)}
        entityType={t('label.test-definition')}
        visible={isDeleteModalVisible}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
};

export default TestDefinitionList;
