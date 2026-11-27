/*
 *  Copyright 2026 Collate.
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
import {
  Box,
  Button,
  ButtonUtility,
  Input,
  ScrollShadow,
  Table,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Config } from '../../../../../generated/type/customProperty';
import { useReportDirty } from '../../../../../hooks/common/useReportDirty';
import { filterPopulatedTableRows } from '../../../../../utils/CustomProperty.utils';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.interface';
import { EditableRow, TableRow } from './TablePropertyValue.interface';

const getColumns = (config: unknown): string[] =>
  (config as Config | undefined)?.columns ?? [];

const getRows = (value: unknown): TableRow[] =>
  (value as { rows?: TableRow[] } | undefined)?.rows ?? [];

// Table cells treat width as a minimum, so min-w and max-w pin each column to
// a third of the host (at most 12rem); break-words keeps long values inside it.
const COLUMN_CLASS =
  'tw:min-w-[min(calc(100cqw/3),12rem)] tw:max-w-[min(calc(100cqw/3),12rem)] tw:break-words';
// The bordered @container box: its width is the host's, so `cqw` above sizes
// columns against what is visible, not against the scrolled content.
const FRAME_CLASS =
  'tw:@container tw:w-full tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary';

const TablePropertyView = ({ property, value }: PropertyViewProps) => {
  const columns = getColumns(property.customPropertyConfig?.config);
  const rows = getRows(value);

  return (
    <div className={FRAME_CLASS} data-testid="table-type-property-value">
      <Table
        scrollShadows
        aria-label={property.displayName || property.name}
        className="tw:w-max tw:min-w-full"
        size="sm">
        <Table.Header>
          {columns.map((column, index) => (
            <Table.Head
              wrapLabel
              className={COLUMN_CLASS}
              id={column}
              isRowHeader={index === 0}
              key={column}
              label={column}
            />
          ))}
        </Table.Header>
        <Table.Body>
          {rows.map((row, rowIndex) => (
            // Stored rows carry no id; this view never reorders them.
            // eslint-disable-next-line react/no-array-index-key
            <Table.Row id={`row-${rowIndex}`} key={rowIndex}>
              {columns.map((column) => (
                <Table.Cell className={COLUMN_CLASS} key={column}>
                  {row[column]}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
};

const TablePropertyEdit = ({
  property,
  value,
  isSaving,
  onSave,
  formId,
  onDirtyChange,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const columns = getColumns(property.customPropertyConfig?.config);
  const nextKey = useRef(0);
  const createRow = (values: TableRow = {}): EditableRow => ({
    key: nextKey.current++,
    values,
  });
  const [rows, setRows] = useState<EditableRow[]>(() => {
    const stored = getRows(value).map((row) => createRow(row));

    return stored.length ? stored : [createRow()];
  });

  const updateCell = (key: number, column: string, cellValue: string) =>
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? { ...row, values: { ...row.values, [column]: cellValue } }
          : row
      )
    );

  const removeRow = (key: number) =>
    setRows((prev) => prev.filter((row) => row.key !== key));

  useReportDirty(
    filterPopulatedTableRows(rows.map((row) => row.values)),
    onDirtyChange
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({
      columns,
      rows: filterPopulatedTableRows(rows.map((row) => row.values)),
    });
  };

  return (
    <form noValidate id={formId} onSubmit={handleSubmit}>
      <Box direction="col" gap={3}>
        <div className={FRAME_CLASS}>
          <ScrollShadow endShadowClassName="tw:right-10">
            <table className="tw:w-max tw:min-w-full tw:text-sm">
              <thead className="tw:bg-secondary">
                <tr>
                  {columns.map((column) => (
                    <th
                      className={`${COLUMN_CLASS} tw:px-2 tw:py-2 tw:text-left tw:text-xs tw:font-semibold tw:text-tertiary`}
                      key={column}
                      scope="col">
                      {column}
                    </th>
                  ))}
                  <th
                    className="tw:sticky tw:right-0 tw:w-10 tw:bg-secondary"
                    scope="col">
                    <span className="tw:sr-only">
                      {t('label.action-plural')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    className="tw:border-t tw:border-secondary"
                    data-testid={`table-row-${rowIndex}`}
                    key={row.key}>
                    {columns.map((column) => (
                      <td
                        className={`${COLUMN_CLASS} tw:px-2 tw:py-1.5`}
                        key={column}>
                        <Input
                          aria-label={`${column} ${rowIndex + 1}`}
                          inputDataTestId={`${column}-${rowIndex}`}
                          isDisabled={isSaving}
                          value={row.values[column] ?? ''}
                          onChange={(cellValue) =>
                            updateCell(row.key, column, cellValue)
                          }
                        />
                      </td>
                    ))}
                    <td className="tw:sticky tw:right-0 tw:bg-primary tw:px-1">
                      <ButtonUtility
                        data-testid={`delete-row-${rowIndex}`}
                        icon={Trash01}
                        isDisabled={isSaving}
                        size="lg"
                        tooltip={t('label.delete-row')}
                        onClick={() => removeRow(row.key)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollShadow>
        </div>
        <Box align="center" gap={3}>
          <Button
            color="secondary"
            data-testid="add-new-row"
            iconLeading={Plus}
            isDisabled={isSaving}
            size="sm"
            onPress={() => setRows((prev) => [...prev, createRow()])}>
            {t('label.add-row')}
          </Button>
          <span className="tw:mr-auto tw:text-xs tw:text-tertiary">
            {t('message.table-rows-empty-removed-on-save', {
              count: rows.length,
            })}
          </span>
        </Box>
      </Box>
    </form>
  );
};

export const tablePropertyRenderer: CustomPropertyRenderer = {
  View: TablePropertyView,
  Edit: TablePropertyEdit,
  getEmptyHint: (property, t) =>
    t('message.table-columns-list', {
      columns: getColumns(property.customPropertyConfig?.config).join(', '),
    }),
};
