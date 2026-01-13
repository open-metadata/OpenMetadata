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
import { isArray } from 'lodash';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import Table from '../../Table/Table';
import './table-type-property-view.less';

interface TableTypePropertyViewProps {
  columns: string[];
  rows: Record<string, string>[];
}

const TableTypePropertyView: FC<TableTypePropertyViewProps> = ({
  columns,
  rows,
}) => {
  const { t } = useTranslation();

  if (!isArray(columns) || !isArray(rows)) {
    return (
      <span className="text-grey-muted" data-testid="invalid-data">
        {t('label.field-invalid', {
          field: `${t('label.column-plural')} or ${t('label.row-plural')}`,
        })}
      </span>
    );
  }

  const tableColumns = columns.map((column: string) => ({
    title: column,
    dataIndex: column,
    key: column,
    render: (text: string) => text || NO_DATA_PLACEHOLDER,
  }));

  return (
    <Table
      resizableColumns
      className="w-full table-type-custom-property"
      columns={tableColumns}
      data-testid="table-type-property-value"
      dataSource={rows}
      pagination={{
        position: ['bottomCenter'],
        pageSize: 10,
        hideOnSinglePage: true,
      }}
      rowKey="name"
      scroll={{ x: true }}
      size="small"
    />
  );
};

export default TableTypePropertyView;
