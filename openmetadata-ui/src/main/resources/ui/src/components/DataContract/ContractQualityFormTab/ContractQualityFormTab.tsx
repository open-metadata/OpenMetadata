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
import { Button, Card, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { Table as TableType } from '../../../generated/entity/data/table';
import { TestCase, TestCaseStatus } from '../../../generated/tests/testCase';
import { EntityReference } from '../../../generated/type/entityReference';
import { usePaging } from '../../../hooks/paging/usePaging';
import { listTestCases, TestCaseType } from '../../../rest/testAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import Table from '../../common/Table/Table';

import { ColumnsType } from 'antd/lib/table';
import { toLower } from 'lodash';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { TEST_LEVEL_OPTIONS } from '../../../utils/DataQuality/DataQualityUtils';
import { SelectionCard } from '../../common/SelectionCardGroup/SelectionCardGroup';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';

export const ContractQualityFormTab: React.FC<{
  selectedQuality: string[];
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  prevLabel?: string;
}> = ({ selectedQuality, onChange, onPrev, prevLabel }) => {
  const [testType, setTestType] = useState<TestCaseType>(TestCaseType.table);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const { data: table } = useGenericContext<TableType>();
  const { pageSize, handlePagingChange } = usePaging();
  const [isTestsLoading, setIsTestsLoading] = useState<boolean>(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    selectedQuality ?? []
  );
  const { t } = useTranslation();

  const columns: ColumnsType<TestCase> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
      },
      {
        title: t('label.status'),
        dataIndex: 'testCaseStatus',
        key: 'testCaseStatus',
        render: (testCaseStatus: TestCaseStatus) => {
          return (
            <StatusBadge
              dataTestId={`status-badge-${testCaseStatus}`}
              label={testCaseStatus}
              status={toLower(testCaseStatus) as StatusType}
            />
          );
        },
      },
    ],
    []
  );

  const fetchAllTests = async () => {
    if (!table?.fullyQualifiedName) {
      return;
    }
    setIsTestsLoading(true);
    try {
      const { data, paging } = await listTestCases({
        entityFQN: table.fullyQualifiedName,
        testCaseType: testType,
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
  }, [testType]);

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

    onChange({
      qualityExpectations,
    });
  };

  return (
    <Card className="container bg-grey p-box">
      <div>
        <Typography.Text className="contract-detail-form-tab-title">
          {t('label.quality')}
        </Typography.Text>
        <Typography.Text className="contract-detail-form-tab-description">
          {t('message.quality-contract-description')}
        </Typography.Text>
      </div>

      <div className="contract-form-content-container ">
        <div className="w-full selection-card-group">
          {TEST_LEVEL_OPTIONS.map((option) => (
            <SelectionCard
              isSelected={testType === option.value}
              key={option.value}
              option={option}
              onClick={() => setTestType(option.value as TestCaseType)}
            />
          ))}
        </div>
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
      </div>

      <div className="d-flex justify-between m-t-md">
        <Button icon={<ArrowLeftOutlined />} type="default" onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
      </div>
    </Card>
  );
};
