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
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import { isUndefined } from 'lodash';
import { lazy, useEffect, useRef } from 'react';
import { RegisterOptions, useFieldArray, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_PARTITION_TYPE_FOR_DATE_TIME } from '../../../../constants/profiler.constant';
import { TABLE_DIFF } from '../../../../constants/TestSuite.constant';
import { CSMode } from '../../../../enums/codemirror.enum';
import { Table } from '../../../../generated/entity/data/table';
import {
  Rule,
  TestCaseParameterDefinition,
  TestDataType,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  validateEquals,
  validateGreaterThanOrEquals,
  validateLessThanOrEquals,
  validateNotEquals,
} from '../../../../utils/ParameterForm/ParameterFormUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import TableDiffFields from './TableDiffFields';
import { FormValues } from './TestCaseFormV1.interface';

const CodeEditor = withSuspenseFallback(
  lazy(() => import('../../../Database/SchemaEditor/CodeEditor'))
);

interface ParamArrayFieldProps {
  form: UseFormReturn<FormValues>;
  data: TestCaseParameterDefinition;
}

const ParamArrayField: React.FC<ParamArrayFieldProps> = ({ form, data }) => {
  const { t } = useTranslation();
  const fieldName = `params.${data.name}` as const;
  const label = getEntityName(data);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: fieldName as never,
  });

  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (!hasSeededRef.current && fields.length === 0) {
      hasSeededRef.current = true;
      append({ value: undefined } as never);
    }
  }, [fields.length, append]);

  const rowRequired = data.required
    ? t('message.field-text-is-required', { fieldText: label })
    : undefined;

  return (
    <div>
      <div className="tw:flex tw:items-center tw:gap-2 tw:mb-1">
        <span>{label}</span>
        <Button
          data-testid={`add-${data.name}`}
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
              name: `params.${data.name}.${index}.value`,
              label: '',
              type: FieldTypes.TEXT,
              required: data.required,
              rules: rowRequired ? { required: rowRequired } : undefined,
              placeholder: t('message.enter-a-field', { field: label }),
              props: {
                'data-testid': `parameter-${data.name}-${index}`,
              },
            } as FieldProp)}
          </div>
          <Button
            color="tertiary-destructive"
            data-testid={`remove-${data.name}-${index}`}
            iconLeading={Trash01}
            size="xs"
            onClick={() => remove(index)}
          />
        </div>
      ))}
    </div>
  );
};

const NUMERIC_DATA_TYPES = [
  TestDataType.Number,
  TestDataType.Int,
  TestDataType.Decimal,
  TestDataType.Double,
  TestDataType.Float,
];

const RULE_VALIDATORS: Record<
  Rule,
  (fieldValue: number, value: number) => Promise<void>
> = {
  [Rule.GreaterThanOrEquals]: validateGreaterThanOrEquals,
  [Rule.LessThanOrEquals]: validateLessThanOrEquals,
  [Rule.Equals]: validateEquals,
  [Rule.NotEquals]: validateNotEquals,
};

export interface ParameterFieldsProps {
  form: UseFormReturn<FormValues>;
  definition: TestDefinition;
  table?: Table;
}

const toSelectOptions = (values: string[]): FormSelectItem[] =>
  values.map((value) => ({ id: value, label: value }));

const ParameterFields: React.FC<ParameterFieldsProps> = ({
  form,
  definition,
  table,
}) => {
  const { t } = useTranslation();

  const buildRules = (
    data: TestCaseParameterDefinition,
    label: string
  ): RegisterOptions | undefined => {
    const rules: RegisterOptions = {};

    if (data.required) {
      rules.required = t('message.field-text-is-required', {
        fieldText: label,
      });
    }

    if (data.validationRule?.parameterField && data.validationRule.rule) {
      const { parameterField, rule } = data.validationRule;
      const dependentPath = `params.${parameterField}` as const;

      rules.validate = async (value) => {
        const fieldValue = Number(form.getValues(dependentPath as never));
        const currentValue = Number(value);
        const validator = RULE_VALIDATORS[rule];

        if (!fieldValue || !currentValue || !validator) {
          return true;
        }

        return validator(fieldValue, currentValue)
          .then(() => true)
          .catch((error: Error) => error.message);
      };
      rules.deps = [dependentPath];
    }

    return Object.keys(rules).length > 0 ? rules : undefined;
  };

  const getColumnOptions = (
    data: TestCaseParameterDefinition
  ): FormSelectItem[] => {
    const isPartitionColumn =
      definition.name === 'tableRowInsertedCountToBeBetween' &&
      data.name === 'columnName';

    const columns = (table?.columns ?? []).filter((column) =>
      isPartitionColumn
        ? SUPPORTED_PARTITION_TYPE_FOR_DATE_TIME.includes(column.dataType)
        : true
    );

    return columns.map((column) => ({
      id: column.name,
      label: getEntityName(column),
    }));
  };

  const getStringFieldProp = (
    data: TestCaseParameterDefinition,
    baseField: FieldProp,
    label: string
  ): FieldProp => {
    const isColumnField =
      data.name === 'column' ||
      (!isUndefined(table) &&
        definition.name === 'tableRowInsertedCountToBeBetween' &&
        data.name === 'columnName');

    if (data.name === 'sqlExpression') {
      return {
        ...baseField,
        type: FieldTypes.COMPONENT,
        props: {
          ...baseField.props,
          children: (
            <CodeEditor
              showCopyButton
              className="custom-query-editor query-editor-h-200"
              mode={{ name: CSMode.SQL }}
            />
          ),
        },
      };
    }

    if (isColumnField) {
      return {
        ...baseField,
        type: FieldTypes.SELECT,
        placeholder: t('message.select-column-name'),
        props: { ...baseField.props, options: getColumnOptions(data) },
      };
    }

    return {
      ...baseField,
      type: FieldTypes.TEXT,
      placeholder: t('message.enter-a-field', { field: label }),
    };
  };

  const getFieldProp = (
    data: TestCaseParameterDefinition
  ): FieldProp | null => {
    const label = getEntityName(data);
    const baseField: FieldProp = {
      name: `params.${data.name}`,
      label,
      type: FieldTypes.TEXT,
      required: data.required,
      rules: buildRules(data, label),
      helperText: data.description,
      props: { 'data-testid': `parameter-${data.name}` },
    };

    if (data.optionValues?.length) {
      return {
        ...baseField,
        type: FieldTypes.SELECT,
        placeholder: t('label.please-select-entity', { entity: label }),
        props: {
          ...baseField.props,
          options: toSelectOptions(data.optionValues as string[]),
        },
      };
    }

    if (data.dataType === TestDataType.String) {
      return getStringFieldProp(data, baseField, label);
    }

    if (data.dataType && NUMERIC_DATA_TYPES.includes(data.dataType)) {
      return {
        ...baseField,
        type: FieldTypes.NUMBER,
        placeholder: t('message.enter-a-field', { field: label }),
      };
    }

    if (data.dataType === TestDataType.Boolean) {
      return {
        ...baseField,
        type: FieldTypes.SWITCH,
        formItemLayout: FormItemLayout.HORIZONTAL,
      };
    }

    return null;
  };

  const isArrayOrSet = (data: TestCaseParameterDefinition): boolean =>
    data.dataType === TestDataType.Array || data.dataType === TestDataType.Set;

  if (definition.fullyQualifiedName === TABLE_DIFF) {
    return (
      <TableDiffFields definition={definition} form={form} table={table} />
    );
  }

  return (
    <>
      {definition.parameterDefinition?.map((data) => {
        if (isArrayOrSet(data)) {
          return (
            <div key={data.name}>
              <ParamArrayField data={data} form={form} />
            </div>
          );
        }

        const fieldProp = getFieldProp(data);

        return fieldProp ? (
          <div key={data.name}>{getField(fieldProp)}</div>
        ) : null;
      })}
    </>
  );
};

export default ParameterFields;
