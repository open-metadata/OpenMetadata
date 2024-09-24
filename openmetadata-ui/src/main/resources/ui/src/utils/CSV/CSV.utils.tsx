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
import { TypeColumn } from '@inovua/reactdatagrid-community/types';
import { compact, get, isEmpty, startCase } from 'lodash';
import React from 'react';
import { ReactComponent as SuccessBadgeIcon } from '../..//assets/svg/success-badge.svg';
import { ReactComponent as FailBadgeIcon } from '../../assets/svg/fail-badge.svg';
import { Status } from '../../generated/type/csvImportResult';
import csvUtilsClassBase from './CSVUtilsClassBase';

export interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
  onCancel: () => void;
  onComplete: (value?: string) => void;
}

export const COLUMNS_WIDTH: Record<string, number> = {
  description: 300,
  tags: 280,
  glossaryTerms: 280,
  tiers: 120,
  status: 70,
};

const statusRenderer = ({
  value,
}: {
  value: Status;
  data: { details: string };
}) => {
  return value === Status.Failure ? (
    <FailBadgeIcon
      className="m-t-xss"
      data-testid="failure-badge"
      height={16}
      width={16}
    />
  ) : (
    <SuccessBadgeIcon
      className="m-t-xss"
      data-testid="success-badge"
      height={16}
      width={16}
    />
  );
};

export const getColumnConfig = (column: string): TypeColumn => {
  const colType = column.split('.').pop() ?? '';

  return {
    header: startCase(column),
    name: column,
    defaultFlex: 1,
    sortable: false,
    renderEditor: csvUtilsClassBase.getEditor(colType),
    minWidth: COLUMNS_WIDTH[colType] ?? 180,
    render: column === 'status' ? statusRenderer : undefined,
  } as TypeColumn;
};

export const getEntityColumnsAndDataSourceFromCSV = (csv: string[][]) => {
  const [cols, ...rows] = csv;

  const columns = cols?.map(getColumnConfig) ?? [];

  const dataSource =
    rows.map((row, idx) => {
      return row.reduce(
        (acc: Record<string, string>, value: string, index: number) => {
          acc[cols[index]] = value;
          acc['id'] = idx + '';

          return acc;
        },
        {} as Record<string, string>
      );
    }) ?? [];

  return {
    columns,
    dataSource,
  };
};

export const getCSVStringFromColumnsAndDataSource = (
  columns: TypeColumn[],
  dataSource: Record<string, string>[]
) => {
  const header = columns.map((col) => col.name).join(',');
  const rows = dataSource.map((row) => {
    const compactValues = compact(columns.map((col) => row[col.name ?? '']));

    if (compactValues.length === 0) {
      return '';
    }

    return columns
      .map((col) => {
        const value = get(row, col.name ?? '', '');
        const colName = col.name ?? '';
        if (
          value.includes(',') ||
          value.includes('\n') ||
          colName.includes('tags') ||
          colName.includes('glossaryTerms') ||
          colName.includes('domain')
        ) {
          return isEmpty(value) ? '' : `"${value}"`;
        }

        return get(row, col.name ?? '', '');
      })
      .join(',');
  });

  return [header, ...compact(rows)].join('\n');
};
