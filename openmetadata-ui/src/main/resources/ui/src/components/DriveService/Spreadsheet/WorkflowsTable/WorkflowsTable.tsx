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
import { ColumnsType } from 'antd/lib/table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import {
  EntityReference,
  Spreadsheet,
} from '../../../../generated/entity/data/spreadsheet';
import { getColumnSorter, getEntityName } from '../../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { descriptionTableObject } from '../../../../utils/TableColumn.util';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Table from '../../../common/Table/Table';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';

function WorkflowsTable() {
  const { t } = useTranslation();
  const { data: spreadsheetDetails } = useGenericContext<Spreadsheet>();

  const columns: ColumnsType<EntityReference> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: 400,
        key: 'name',
        sorter: getColumnSorter<EntityReference, 'name'>('name'),
        render: (_, record) => (
          <div className="d-inline-flex w-max-90">
            <Link
              className="break-word"
              data-testid="container-name"
              to={getEntityDetailsPath(
                record.type as EntityType,
                record.fullyQualifiedName ?? ''
              )}>
              {getEntityName(record)}
            </Link>
          </div>
        ),
      },
      ...descriptionTableObject(),
    ],
    []
  );

  return (
    <Table
      columns={columns}
      data-testid="container-list-table"
      dataSource={spreadsheetDetails.worksheets}
      locale={{
        emptyText: <ErrorPlaceHolder className="p-y-md" />,
      }}
      pagination={false}
      rowKey="id"
      size="small"
    />
  );
}

export default WorkflowsTable;
