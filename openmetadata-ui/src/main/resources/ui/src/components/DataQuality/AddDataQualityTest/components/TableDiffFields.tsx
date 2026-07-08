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
  FormItemLayout,
  FormSelectItem,
  getField,
  HelperTextType,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@untitledui/icons';
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
  TestDataType,
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

export const TABLE2 = 'table2';
export const TABLE2_KEY_COLUMNS = 'table2.keyColumns';
export const KEY_COLUMNS = 'keyColumns';
export const USE_COLUMNS = 'useColumns';

const NUMERIC_DATA_TYPES = [
  TestDataType.Number,
  TestDataType.Int,
  TestDataType.Decimal,
  TestDataType.Double,
  TestDataType.Float,
];

const paramFieldName = (name: string): string =>
  `params.${sanitizeParamName(name)}`;

const getSelectedColumnNames = (
  rows: Array<{ value?: string | FormSelectItem }> | undefined
): Set<string> =>
  new Set(
    (rows ?? [])
      .map((row) =>
        typeof row?.value === 'string' ? row.value : row?.value?.id
      )
      .filter(Boolean) as string[]
  );

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
          aria-label={t('label.add-entity', { entity: label })}
          data-testid={`add-${data.name}`}
          disabled={disabled}
          iconLeading={Plus}
          size="xs"
          onClick={() => append({ value: undefined } as never)}
        />
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
              id: `testCaseFormV1_params_${data.name}_${index}_value`,
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

  // Remaining tableDiff parameters (where, threshold, caseSensitiveColumns,
  // ...) get generic inputs by data type, like the legacy form's default.
  // Rendered in parameterDefinition order via renderParameter below.

  const getRemainingFieldProp = (
    data: TestCaseParameterDefinition
  ): FieldProp => {
    const label = getEntityName(data);
    const baseField: FieldProp = {
      name: paramFieldName(data.name ?? ''),
      label,
      type: FieldTypes.TEXT,
      required: data.required,
      id: `testCaseFormV1_params_${data.name}`,
      rules: data.required
        ? {
            required: t('message.field-text-is-required', {
              fieldText: label,
            }),
          }
        : undefined,
      helperText: data.description,
      helperTextType: HelperTextType.TOOLTIP,
      placeholder: t('message.enter-a-field', { field: label }),
      props: { 'data-testid': `parameter-${data.name}` },
    };

    if (data.dataType === TestDataType.Boolean) {
      return {
        ...baseField,
        type: FieldTypes.SWITCH,
        formItemLayout: FormItemLayout.HORIZONTAL,
      };
    }

    if (data.dataType && NUMERIC_DATA_TYPES.includes(data.dataType)) {
      return { ...baseField, type: FieldTypes.NUMBER };
    }

    return baseField;
  };

  const renderParameter = (data: TestCaseParameterDefinition) => {
    switch (data.name) {
      case TABLE2:
        return getField({
          name: paramFieldName(TABLE2),
          label: getEntityName(data),
          type: FieldTypes.ASYNC_SELECT,
          required: data.required,
          helperText: data.description,
          helperTextType: HelperTextType.TOOLTIP,
          placeholder: t('label.table'),
          id: `testCaseFormV1_params_${TABLE2}`,
          props: {
            'data-testid': TABLE2,
            isLoading: isOptionsLoading,
            options: tableOptions,
            onSearchChange: debounceFetchTableData,
          },
        } as FieldProp);
      case KEY_COLUMNS:
        return (
          <ColumnArrayField
            columns={table?.columns}
            data={data}
            excludedColumns={crossListExcludedColumns}
            form={form}
          />
        );
      case TABLE2_KEY_COLUMNS:
        return (
          <ColumnArrayField
            columns={table2Columns}
            data={data}
            disabled={!table2Fqn}
            form={form}
          />
        );
      case USE_COLUMNS:
        return (
          <ColumnArrayField
            columns={table?.columns}
            data={data}
            excludedColumns={crossListExcludedColumns}
            form={form}
          />
        );
      default:
        return getField(getRemainingFieldProp(data));
    }
  };

  return (
    <>
      {(definition.parameterDefinition ?? [])
        .filter((data) => data.name)
        .map((data) => (
          <div key={data.name}>{renderParameter(data)}</div>
        ))}
    </>
  );
};

export default TableDiffFields;
