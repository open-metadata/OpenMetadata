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

import { Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';
import { Typography } from 'antd';
import { startCase } from 'lodash';
import type { Column, RenderCellProps } from 'react-data-grid';
import { ReactComponent as SuccessBadgeIcon } from '../..//assets/svg/success-badge.svg';
import { ReactComponent as FailBadgeIcon } from '../../assets/svg/fail-badge.svg';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { EntityType } from '../../enums/entity.enum';
import { Status } from '../../generated/type/csvImportResult';
import { COLUMNS_WIDTH, CSV_DISABLED_COLUMNS } from './CSVPureUtils';
import csvUtilsClassBase from './CSVUtilsClassBase';

export interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
  onCancel: () => void;
  onComplete: (value?: string) => void;
}

const statusRenderer = (value: Status) => {
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

export const renderColumnDataEditor = (
  column: string,
  recordData: {
    value: string;
    data: { details: string; glossaryStatus: string };
  }
) => {
  const {
    value,
    data: { glossaryStatus },
  } = recordData;
  switch (column) {
    case 'status':
      return statusRenderer(value as Status);
    case 'glossaryStatus':
      return <Typography.Text>{glossaryStatus}</Typography.Text>;
    case 'description':
      return (
        <RichTextEditorPreviewerV1
          enableSeeMoreVariant={false}
          markdown={value}
          reducePreviewLineClass="max-one-line"
        />
      );
    case 'parameterValues':
      return value ? (
        <Tooltip
          containerClassName="tw:max-w-sm tw:break-all"
          placement="top"
          title={value}>
          <TooltipTrigger>
            <span className="tw:block tw:truncate">{value}</span>
          </TooltipTrigger>
        </Tooltip>
      ) : (
        value
      );

    default:
      return value;
  }
};

export const getColumnConfig = (
  column: string,
  entityType: EntityType,
  multipleOwner: {
    user: boolean;
    team: boolean;
  },
  editable = false,
  isBulkEdit = false
): Column<Record<string, unknown>> => {
  const colType = column.split('.').pop() ?? '';
  const disabledColumns = isBulkEdit
    ? CSV_DISABLED_COLUMNS.includes(colType)
    : false;

  return {
    key: column,
    name: startCase(column),
    sortable: false,
    resizable: true,
    cellClass: () => `rdg-cell-${column.replaceAll(/[^a-zA-Z0-9-_]/g, '')}`,
    editable: editable ? !disabledColumns : false,
    renderEditCell: csvUtilsClassBase.getEditor(
      colType,
      entityType,
      multipleOwner
    ),
    renderCell: (data: RenderCellProps<Record<string, unknown>>) =>
      renderColumnDataEditor(colType, {
        value: data.row[column] as string | undefined,
        data: { details: '', glossaryStatus: '' },
      }),
    minWidth: COLUMNS_WIDTH[colType] ?? 180,
  } as Column<Record<string, unknown>>;
};

export const getEntityColumnsAndDataSourceFromCSV = (
  csv: string[][],
  entityType: EntityType,
  multipleOwner: {
    user: boolean;
    team: boolean;
  },
  cellEditable: boolean,
  isBulkEdit: boolean
) => {
  const [cols, ...rows] = csv;

  const columns =
    cols?.map((column) =>
      getColumnConfig(
        column,
        entityType,
        multipleOwner,
        cellEditable,
        isBulkEdit
      )
    ) ?? [];

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
