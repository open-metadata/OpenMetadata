/*
 *  Copyright 2023 Collate.
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
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import ExpandableCard from '../../../components/common/ExpandableCard/ExpandableCard';
import Table from '../../../components/common/Table/Table';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericProvider';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import {
  PartitionColumnDetails,
  Table as TableType,
} from '../../../generated/entity/data/table';

export const PartitionedKeys = () => {
  const { data, filterWidgets } = useGenericContext<TableType>();

  const partitionColumnDetails = useMemo(
    () =>
      data?.tablePartition?.columns?.map((column) => ({
        ...column,
        key: column.columnName,
      })),
    [data?.tablePartition?.columns]
  );

  const columns = useMemo(() => {
    const data: ColumnsType<PartitionColumnDetails> = [
      {
        title: t('label.column'),
        dataIndex: 'columnName',
        key: 'columnName',
        ellipsis: true,
        width: '50%',
      },
      {
        title: t('label.type'),
        dataIndex: 'intervalType',
        key: 'intervalType',
        ellipsis: true,
        width: '50%',
        render: (text) => {
          return text ?? '--';
        },
      },
    ];

    return data;
  }, []);

  useEffect(() => {
    if (isEmpty(partitionColumnDetails)) {
      filterWidgets?.([DetailPageWidgetKeys.PARTITIONED_KEYS]);
    }
  }, [partitionColumnDetails]);

  if (!data?.tablePartition) {
    return null;
  }

  const content = (
    <Table
      columns={columns}
      data-testid="partitioned-column-table"
      dataSource={partitionColumnDetails}
      pagination={false}
      rowKey="name"
      size="small"
    />
  );

  return (
    <ExpandableCard
      cardProps={{
        title: t('label.table-partition-plural'),
      }}
      isExpandDisabled={isEmpty(partitionColumnDetails)}>
      {content}
    </ExpandableCard>
  );
};
