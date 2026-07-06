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
import {
  Button,
  FieldProp,
  FieldTypes,
  FormSelectItem,
  getField,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { WILD_CARD_CHAR } from '../../../../constants/char.constants';
import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { SearchIndex } from '../../../../enums/search.enum';
import { Column, Table } from '../../../../generated/entity/data/table';
import {
  TestCaseParameterDefinition,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import {
  SearchHitBody,
  TableSearchSource,
} from '../../../../interface/search.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  restoreParamName,
  sanitizeParamName,
} from '../../../../utils/ParameterForm/ParameterFieldsUtils';
import { FormValues } from './TestCaseFormV1.interface';

export { restoreParamName, sanitizeParamName };

type TableHit = SearchHitBody<
  SearchIndex.TABLE,
  Pick<
    TableSearchSource,
    'name' | 'displayName' | 'fullyQualifiedName' | 'columns'
  >
>;

const TABLE2 = 'table2';
const TABLE2_KEY_COLUMNS = 'table2.keyColumns';
const KEY_COLUMNS = 'keyColumns';
const USE_COLUMNS = 'useColumns';

const paramFieldName = (name: string): string =>
  `params.${sanitizeParamName(name)}`;

const getSelectedColumnNames = (
  rows: Array<{ value?: string }> | undefined
): Set<string> =>
  new Set((rows ?? []).map((row) => row?.value).filter(Boolean) as string[]);

interface ColumnArrayFieldProps {
  form: UseFormReturn<FormValues>;
  data: TestCaseParameterDefinition;
  columns?: Column[];
  disabled?: boolean;
  excludedColumns?: Set<string>;
}

const ColumnArrayField: React.FC<ColumnArrayFieldProps> = ({
  form,
  data,
  columns,
  disabled,
  excludedColumns,
}) => {
  const { t } = useTranslation();
  const fieldName = paramFieldName(data.name ?? '');
  const label = getEntityName(data);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: fieldName as never,
  });

  const rows = useWatch({
    control: form.control,
    name: fieldName as never,
  }) as Array<{ value?: string }> | undefined;

  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (!hasSeededRef.current && fields.length === 0) {
      hasSeededRef.current = true;
      append({ value: undefined } as never);
    }
  }, [fields.length, append]);

  const selectedColumns = useMemo(() => getSelectedColumnNames(rows), [rows]);

  const options: FormSelectItem[] = useMemo(
    () =>
      (columns ?? []).map((column) => ({
        id: column.name,
        label: getEntityName(column),
        isDisabled:
          selectedColumns.has(column.name) ||
          (excludedColumns?.has(column.name) ?? false),
      })),
    [columns, selectedColumns, excludedColumns]
  );

  return (
    <div>
      <div className="tw:flex tw:items-center tw:gap-2 tw:mb-1">
        <span>{label}</span>
        <Button
          data-testid={`add-${data.name}`}
          disabled={disabled}
          size="xs"
          onClick={() => append({ value: undefined } as never)}>
          {t('label.add-entity', { entity: label })}
        </Button>
      </div>
      {fields.map((field, index) => (
        <div
          className="tw:flex tw:items-center tw:gap-2 tw:mb-1"
          key={field.id}>
          <div className="tw:flex-1">
            {getField({
              name: `${fieldName}.${index}.value`,
              label: '',
              type: FieldTypes.SELECT,
              required: data.required,
              placeholder: t('message.select-column-name'),
              props: {
                'aria-label': label,
                isDisabled: disabled,
                options,
                'data-testid': `parameter-${data.name}-${index}`,
              },
            } as FieldProp)}
          </div>
          <Button
            color="tertiary-destructive"
            data-testid={`remove-${data.name}-${index}`}
            disabled={disabled}
            iconLeading={Trash01}
            size="xs"
            onClick={() => remove(index)}
          />
        </div>
      ))}
    </div>
  );
};

export interface TableDiffFieldsProps {
  form: UseFormReturn<FormValues>;
  definition: TestDefinition;
  table?: Table;
}

const TableDiffFields: React.FC<TableDiffFieldsProps> = ({
  form,
  definition,
  table,
}) => {
  const { t } = useTranslation();
  const [isOptionsLoading, setIsOptionsLoading] = useState(false);
  const [tableList, setTableList] = useState<TableHit[]>([]);
  const [table2Columns, setTable2Columns] = useState<Column[] | undefined>();

  const table2Value = useWatch({
    control: form.control,
    name: paramFieldName(TABLE2) as never,
  }) as FormSelectItem | null | undefined;

  const table2Fqn = table2Value?.id;

  const tableOptions: FormSelectItem[] = useMemo(
    () =>
      tableList.map((hit) => ({
        id: hit._source.fullyQualifiedName ?? '',
        label: hit._source.fullyQualifiedName ?? '',
      })),
    [tableList]
  );

  const fetchTableData = useCallback(async (search = WILD_CARD_CHAR) => {
    setIsOptionsLoading(true);
    try {
      const response = await searchQuery({
        query: `*${search}*`,
        pageNumber: 1,
        pageSize: PAGE_SIZE_LARGE,
        searchIndex: SearchIndex.TABLE,
        fetchSource: true,
        includeFields: ['name', 'fullyQualifiedName', 'displayName', 'columns'],
      });
      setTableList(response.hits.hits as TableHit[]);
    } catch {
      setTableList([]);
    } finally {
      setIsOptionsLoading(false);
    }
  }, []);

  const debounceFetchTableData = useMemo(
    () => debounce(fetchTableData, 1000),
    [fetchTableData]
  );

  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  useEffect(
    () => () => {
      debounceFetchTableData.cancel();
    },
    [debounceFetchTableData]
  );

  useEffect(() => {
    if (!table2Fqn) {
      setTable2Columns(undefined);

      return;
    }

    const selectedTable = tableList.find(
      (hit) => hit._source.fullyQualifiedName === table2Fqn
    );

    if (selectedTable) {
      setTable2Columns(selectedTable._source.columns);
    }
  }, [table2Fqn, tableList]);

  const previousTable2FqnRef = useRef<string | undefined>(table2Fqn);
  useEffect(() => {
    if (previousTable2FqnRef.current !== table2Fqn) {
      previousTable2FqnRef.current = table2Fqn;
      form.setValue(
        paramFieldName(TABLE2_KEY_COLUMNS) as never,
        [{ value: undefined }] as never
      );
    }
  }, [table2Fqn, form]);

  const keyColumnsRows = useWatch({
    control: form.control,
    name: paramFieldName(KEY_COLUMNS) as never,
  }) as Array<{ value?: string }> | undefined;

  const useColumnsRows = useWatch({
    control: form.control,
    name: paramFieldName(USE_COLUMNS) as never,
  }) as Array<{ value?: string }> | undefined;

  const crossListExcludedColumns = useMemo(() => {
    const keySet = getSelectedColumnNames(keyColumnsRows);
    const useSet = getSelectedColumnNames(useColumnsRows);

    return new Set<string>([...keySet, ...useSet]);
  }, [keyColumnsRows, useColumnsRows]);

  const parameterMap = useMemo(() => {
    const map: Record<string, TestCaseParameterDefinition> = {};
    definition.parameterDefinition?.forEach((data) => {
      if (data.name) {
        map[data.name] = data;
      }
    });

    return map;
  }, [definition.parameterDefinition]);

  const table2Definition = parameterMap[TABLE2];
  const keyColumnsDefinition = parameterMap[KEY_COLUMNS];
  const table2KeyColumnsDefinition = parameterMap[TABLE2_KEY_COLUMNS];
  const useColumnsDefinition = parameterMap[USE_COLUMNS];

  return (
    <>
      {table2Definition && (
        <div>
          {getField({
            name: paramFieldName(TABLE2),
            label: getEntityName(table2Definition),
            type: FieldTypes.ASYNC_SELECT,
            required: table2Definition.required,
            helperText: table2Definition.description,
            placeholder: t('label.table'),
            props: {
              'data-testid': TABLE2,
              isLoading: isOptionsLoading,
              options: tableOptions,
              onSearchChange: debounceFetchTableData,
            },
          } as FieldProp)}
        </div>
      )}
      {keyColumnsDefinition && (
        <div>
          <ColumnArrayField
            columns={table?.columns}
            data={keyColumnsDefinition}
            excludedColumns={crossListExcludedColumns}
            form={form}
          />
        </div>
      )}
      {table2KeyColumnsDefinition && (
        <div>
          <ColumnArrayField
            columns={table2Columns}
            data={table2KeyColumnsDefinition}
            disabled={!table2Fqn}
            form={form}
          />
        </div>
      )}
      {useColumnsDefinition && (
        <div>
          <ColumnArrayField
            columns={table?.columns}
            data={useColumnsDefinition}
            excludedColumns={crossListExcludedColumns}
            form={form}
          />
        </div>
      )}
    </>
  );
};

export default TableDiffFields;
