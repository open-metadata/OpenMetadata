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
import Icon from '@ant-design/icons';
import { Col, Row, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowIcon } from '../../../assets/svg/arrow-right-full.svg';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { Column } from '../../../generated/entity/data/table';
import { getContractStatusType } from '../../../utils/DataContract/DataContractUtils';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import Table from '../../common/Table/Table';
import './contract-schema.less';

const ContractSchemaTable: React.FC<{
  schemaDetail: Column[];
  contractStatus?: string;
}> = ({ schemaDetail, contractStatus }) => {
  const { t } = useTranslation();

  const schemaColumns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (name: string) => (
          <Typography.Text className="text-primary">{name}</Typography.Text>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataType',
        key: 'dataType',
        render: (type: string) => (
          <Tag className="custom-tag" color="purple">
            {type}
          </Tag>
        ),
      },
      {
        title: t('label.constraint-plural'),
        dataIndex: 'constraint',
        key: 'constraint',
        render: (constraint: string) => (
          <div>
            {constraint ? (
              <Tag className="custom-tag" color="blue">
                {constraint}
              </Tag>
            ) : (
              <Typography.Text data-testid="no-constraints">
                {NO_DATA_PLACEHOLDER}
              </Typography.Text>
            )}
          </div>
        ),
      },
    ],
    [t]
  );

  return (
    <Row className="contract-schema-component-container" gutter={[20, 0]}>
      <Col span={12}>
        <Table
          columns={schemaColumns}
          dataSource={schemaDetail}
          pagination={{
            size: 'default',
            pageSize: 5,
            prevIcon: <Icon component={ArrowIcon} />,
            nextIcon: <Icon component={ArrowIcon} />,
            className: 'schema-custom-pagination',
          }}
          rowKey="name"
          size="small"
        />
      </Col>
      <Col className="d-flex justify-end" span={12}>
        {contractStatus && (
          <div className="contract-status-container">
            <Typography.Text>{`${t('label.entity-status', {
              entity: t('label.schema'),
            })} :`}</Typography.Text>
            <StatusBadgeV2
              dataTestId="contract-status-card-item-schema-status"
              label={contractStatus}
              status={getContractStatusType(contractStatus)}
            />
          </div>
        )}
      </Col>
    </Row>
  );
};

export default ContractSchemaTable;
