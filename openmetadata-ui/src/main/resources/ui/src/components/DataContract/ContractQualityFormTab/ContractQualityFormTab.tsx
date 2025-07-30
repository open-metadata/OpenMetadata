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

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Radio, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { Table as TableType } from '../../../generated/entity/data/table';
import { TestCase } from '../../../generated/tests/testCase';
import { EntityReference } from '../../../generated/type/entityReference';
import { usePaging } from '../../../hooks/paging/usePaging';
import { listTestCases, TestCaseType } from '../../../rest/testAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import Table from '../../common/Table/Table';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';

export const ContractQualityFormTab: React.FC<{
  selectedQuality: string[];
  onUpdate: (data: EntityReference[]) => void;
  onPrev: () => void;
  prevLabel?: string;
}> = ({ selectedQuality, onUpdate, onPrev, prevLabel }) => {
  const [testType, setTestType] = useState<'table' | 'column'>('table');
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const { data: table } = useGenericContext<TableType>();
  const { pageSize, handlePagingChange } = usePaging();
  const [isTestsLoading, setIsTestsLoading] = useState<boolean>(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    selectedQuality ?? []
  );
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
      },
    ],
    [t]
  );

  const fetchAllTests = async () => {
    if (!table?.fullyQualifiedName) {
      return;
    }
    setIsTestsLoading(true);
    try {
      const { data, paging } = await listTestCases({
        entityFQN: table.fullyQualifiedName,
        testCaseType:
          testType === 'table' ? TestCaseType.table : TestCaseType.column,
        limit: pageSize,
      });

      setAllTestCases(data);
      handlePagingChange(paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTestsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTests();
  }, []);

  const handleSelection = (selectedRowKeys: string[]) => {
    const qualityExpectations = selectedRowKeys.map((id) => {
      const testCase = allTestCases.find((test) => test.id === id);

      return {
        description: testCase?.description,
        name: testCase?.name,
        id: testCase?.id,
        type: EntityType.TEST_CASE,
      } as EntityReference;
    });

    onUpdate(qualityExpectations);
  };

  return (
    <Card className="container bg-grey p-box">
      <Typography.Title level={5}>{t('label.quality')}</Typography.Title>
      <Typography.Text type="secondary">
        {t('message.quality-contract-description')}
      </Typography.Text>
      <Card>
        <Radio.Group
          className="m-b-sm"
          value={testType}
          onChange={(e) => setTestType(e.target.value)}>
          <Radio.Button value="table">{t('label.table')}</Radio.Button>
          <Radio.Button value="column">{t('label.column')}</Radio.Button>
        </Radio.Group>
        <Table
          columns={columns}
          dataSource={allTestCases}
          loading={isTestsLoading}
          pagination={false}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (selectedRowKeys) => {
              setSelectedKeys(selectedRowKeys as string[]);
              handleSelection(selectedRowKeys as string[]);
            },
          }}
        />
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button icon={<ArrowLeftOutlined />} type="default" onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
      </div>
    </Card>
  );
};
