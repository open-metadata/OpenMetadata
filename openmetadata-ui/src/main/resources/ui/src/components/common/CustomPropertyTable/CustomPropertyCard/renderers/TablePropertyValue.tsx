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
  Table,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Config } from '../../../../../generated/type/customProperty';
import { filterPopulatedTableRows } from '../../../../../utils/CustomProperty.utils';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.types';

type TableRow = Record<string, string>;

interface EditableRow {
  key: number;
  values: TableRow;
}

const getColumns = (config: unknown): string[] =>
  (config as Config | undefined)?.columns ?? [];

const getRows = (value: unknown): TableRow[] =>
  (value as { rows?: TableRow[] } | undefined)?.rows ?? [];

const TablePropertyView = ({ property, value }: PropertyViewProps) => {
  const columns = getColumns(property.customPropertyConfig?.config);
  const rows = getRows(value);

  return (
    <div
      className="tw:overflow-x-auto tw:rounded-lg tw:border tw:border-secondary"
      data-testid="table-type-property-value">
      <Table aria-label={property.displayName || property.name} size="sm">
        <Table.Header>
          {columns.map((column, index) => (
            <Table.Head
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
                <Table.Cell key={column}>{row[column]}</Table.Cell>
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
        <div className="tw:overflow-x-auto tw:rounded-lg tw:border tw:border-secondary">
          <table className="tw:w-full tw:text-sm">
            <thead className="tw:bg-secondary">
              <tr>
                {columns.map((column) => (
                  <th
                    className="tw:px-2 tw:py-2 tw:text-left tw:text-xs tw:font-semibold tw:text-tertiary"
                    key={column}
                    scope="col">
                    {column}
                  </th>
                ))}
                <th className="tw:w-10" scope="col">
                  <span className="tw:sr-only">{t('label.action-plural')}</span>
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
                    <td className="tw:px-2 tw:py-1.5" key={column}>
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
                  <td className="tw:px-1">
                    <ButtonUtility
                      color="tertiary"
                      data-testid={`delete-row-${rowIndex}`}
                      icon={Trash01}
                      isDisabled={isSaving}
                      size="xs"
                      tooltip={t('label.delete-row')}
                      onClick={() => removeRow(row.key)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
