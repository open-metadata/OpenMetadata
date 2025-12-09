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

import { Button, Card, Col, Row, Space, Switch, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { compare } from 'fast-json-patch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { TestDefinition } from '../../../generated/tests/testDefinition';
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

  const fetchTestDefinitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
      };

      // Only add cursor parameters if they have values
      if (paging.before) {
        params.before = paging.before;
      }
      if (paging.after) {
        params.after = paging.after;
      }

      const response = await getListTestDefinitions(params);
      setTestDefinitions(response.data);
      handlePagingChange(response.paging);
    } catch (error) {
      showErrorToast(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, paging.before, paging.after, handlePagingChange]);

  useEffect(() => {
    fetchTestDefinitions();
  }, [fetchTestDefinitions]);

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

  const handleDelete = async (record: TestDefinition) => {
    try {
      await deleteTestDefinitionById(record.id ?? '');
      showSuccessToast(
        t('message.entity-deleted-success', {
          entity: t('label.test-definition'),
        })
      );
      fetchTestDefinitions();
    } catch (error) {
      showErrorToast(error as Error);
    }
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
        render: (_, record: TestDefinition) => (
          <Space size="small">
            <Button
              data-testid={`edit-${record.name}`}
              icon={<IconEdit height={16} width={16} />}
              type="text"
              onClick={() => handleEdit(record)}
            />
            <Button
              data-testid={`delete-${record.name}`}
              icon={<IconDelete height={16} width={16} />}
              type="text"
              onClick={() => handleDelete(record)}
            />
          </Space>
        ),
      },
    ],
    [t]
  );

  const handlePageChangeCallback = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (cursorType) {
      handlePagingChange({ [cursorType]: paging[cursorType] });
    }
    handlePageChange(currentPage);
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
                  data-testid="add-test-definition"
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
    </>
  );
};

export default TestDefinitionList;
