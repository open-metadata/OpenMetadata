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
  Modal,
  Row,
  Space,
  Switch,
  Table,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { compare } from 'fast-json-patch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ProviderType } from '../../../generated/entity/bot';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import {
  deleteTestDefinitionById,
  getListTestDefinitions,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import TestDefinitionForm from '../TestDefinitionForm/TestDefinitionForm.component';

const TestDefinitionList = () => {
  const { t } = useTranslation();
  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
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
      } catch (error) {
        showErrorToast(error as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, handlePagingChange]
  );

  useEffect(() => {
    fetchTestDefinitions();
  }, []);

  const handleEnableToggle = async (
    record: TestDefinition,
    checked: boolean
  ) => {
    try {
      const originalData = { ...record };
      const updatedData = { ...record, enabled: checked };
      const patch = compare(originalData, updatedData);

      await patchTestDefinition(record.id ?? '', patch);
      showSuccessToast(
        t('message.entity-updated-success', {
          entity: t('label.test-definition'),
        })
      );
      fetchTestDefinitions();
    } catch (error) {
      showErrorToast(error as Error);
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
      await deleteTestDefinitionById(definitionToDelete.id ?? '');
      showSuccessToast(
        t('message.entity-deleted-success', {
          entity: t('label.test-definition'),
        })
      );
      setIsDeleteModalVisible(false);
      setDefinitionToDelete(undefined);
      fetchTestDefinitions();
    } catch (error) {
      showErrorToast(error as Error);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalVisible(false);
    setDefinitionToDelete(undefined);
  };

  const handleFormSuccess = () => {
    setIsFormVisible(false);
    setSelectedDefinition(undefined);
    fetchTestDefinitions();
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
        width: 250,
        render: (name: string, record: TestDefinition) => (
          <Typography.Text>{record.displayName || name}</Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (description: string) => (
          <Typography.Text>{description || '--'}</Typography.Text>
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
        title: t('label.test-platform'),
        dataIndex: 'testPlatforms',
        key: 'testPlatforms',
        width: 200,
        render: (testPlatforms: string[]) => (
          <Typography.Text>{testPlatforms?.join(', ') || '--'}</Typography.Text>
        ),
      },
      {
        title: t('label.enabled'),
        dataIndex: 'enabled',
        key: 'enabled',
        width: 100,
        render: (enabled: boolean, record: TestDefinition) => (
          <Switch
            checked={enabled ?? true}
            size="small"
            onChange={(checked) => handleEnableToggle(record, checked)}
          />
        ),
      },
      {
        title: t('label.action-plural'),
        key: 'actions',
        width: 120,
        fixed: 'right',
        render: (_, record: TestDefinition) => {
          const isSystemProvider = record.provider === ProviderType.System;

          return (
            <Space size="small">
              {!isSystemProvider && (
                <>
                  <Button
                    data-testid={`edit-test-definition-${record.name}`}
                    icon={<IconEdit height={16} width={16} />}
                    type="text"
                    onClick={() => handleEdit(record)}
                  />
                  <Button
                    data-testid={`delete-test-definition-${record.name}`}
                    icon={<IconDelete height={16} width={16} />}
                    type="text"
                    onClick={() => handleDeleteClick(record)}
                  />
                </>
              )}
            </Space>
          );
        },
      },
    ],
    [t]
  );

  const handlePageChangeCallback = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (cursorType) {
      fetchTestDefinitions({
        [cursorType]: paging[cursorType],
        total: paging.total,
      } as Paging);
      handlePageChange(
        currentPage,
        { cursorType, cursorValue: paging[cursorType] },
        pageSize
      );
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Row justify="space-between">
              <Col>
                <Typography.Title level={5}>
                  {t('label.test-definition-plural')}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {t('message.page-sub-header-for-test-definitions')}
                </Typography.Text>
              </Col>
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
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          {testDefinitions.length > 0 ? (
            <>
              <Table
                bordered
                columns={columns}
                data-testid="test-definition-table"
                dataSource={testDefinitions}
                loading={isLoading}
                pagination={false}
                rowKey="id"
                scroll={{ x: 1200 }}
                size="small"
              />
              {paging && (
                <NextPrevious
                  currentPage={currentPage}
                  pageSize={pageSize}
                  paging={paging}
                  pagingHandler={handlePageChangeCallback}
                />
              )}
            </>
          ) : (
            <ErrorPlaceHolder />
          )}
        </Col>
      </Row>

      {isFormVisible && (
        <TestDefinitionForm
          initialValues={selectedDefinition}
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
        />
      )}

      <Modal
        cancelText={t('label.cancel')}
        okText={t('label.delete')}
        open={isDeleteModalVisible}
        title={t('label.delete-entity', {
          entity: t('label.test-definition'),
        })}
        onCancel={handleDeleteCancel}
        onOk={handleDeleteConfirm}>
        <Typography.Text>
          {t('message.are-you-sure-delete', {
            name: definitionToDelete?.displayName || definitionToDelete?.name,
          })}
        </Typography.Text>
      </Modal>
    </>
  );
};

export default TestDefinitionList;
