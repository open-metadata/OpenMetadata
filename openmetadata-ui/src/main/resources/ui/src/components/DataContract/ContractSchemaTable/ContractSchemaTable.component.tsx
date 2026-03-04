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
import { ColumnsType, ColumnType, TablePaginationConfig } from 'antd/lib/table';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowIcon } from '../../../assets/svg/arrow-right-full.svg';
import { ReactComponent as FailedIcon } from '../../../assets/svg/fail-badge.svg';
import { ReactComponent as CompletedIcon } from '../../../assets/svg/ic-check-circle-colored.svg';
import { LIST_SIZE, NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { Column } from '../../../generated/entity/data/table';
import { SchemaValidation } from '../../../generated/entity/datacontract/dataContractResult';
import { getContractStatusType } from '../../../utils/DataContract/DataContractUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import Table from '../../common/Table/Table';
import './contract-schema.less';

const ContractSchemaTable: React.FC<{
  schemaDetail: Column[];
  contractStatus?: string;
  latestSchemaValidationResult?: SchemaValidation;
}> = ({ schemaDetail, contractStatus, latestSchemaValidationResult }) => {
  const { t } = useTranslation();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();

  const tablePaginationProps: TablePaginationConfig = useMemo(
    () => ({
      size: 'default',
      hideOnSinglePage: true,
      pageSize: LIST_SIZE,
      prevIcon: <Icon component={ArrowIcon} />,
      nextIcon: <Icon component={ArrowIcon} />,
      className: 'schema-custom-pagination',
    }),
    []
  );

  const schemaColumns: ColumnsType<Column> = useMemo(
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
      ...(entityType === EntityType.TABLE
        ? [
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
          ]
        : []),
      ...(latestSchemaValidationResult
        ? [
            {
              title: t('label.column-status'),
              dataIndex: 'name',
              key: 'columnStatus',
              align: 'center',
              render: (name: string) => {
                const isColumnFailed =
                  latestSchemaValidationResult?.failedFields?.includes(name);
                const iconClass = isColumnFailed ? 'failed' : 'success';

                return (
                  <Icon
                    className={classNames('column-status-icon', iconClass)}
                    component={isColumnFailed ? FailedIcon : CompletedIcon}
                    data-testid={`schema-column-${name}-${iconClass}`}
                  />
                );
              },
            } as ColumnType<Column>,
          ]
        : []),
    ],
    [entityType, latestSchemaValidationResult]
  );

  return (
    <Row className="contract-schema-component-container" gutter={[20, 0]}>
      <Col span={12}>
        <Table
          columns={schemaColumns}
          dataSource={schemaDetail}
          pagination={tablePaginationProps}
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
