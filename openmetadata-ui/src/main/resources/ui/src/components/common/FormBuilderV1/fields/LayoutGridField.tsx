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
  FieldProps,
  getUiOptions,
  IdSchema,
  orderProperties,
  RJSFSchema,
  UiSchema,
} from '@rjsf/utils';
import { get, merge } from 'lodash';

interface LayoutGridColumn {
  className?: string;
  name: string;
  uiSchema?: UiSchema;
}

interface LayoutGridRow {
  className?: string;
  columns: LayoutGridColumn[];
}

interface LayoutGridOptions {
  className?: string;
  order?: string[];
  rowClassName?: string;
  rows?: LayoutGridRow[];
  unplacedFieldsClassName?: string;
}

const getClassName = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value : fallback;

const LayoutGridField = (props: FieldProps) => {
  const {
    schema: rawSchema,
    uiSchema = {},
    formData,
    errorSchema,
    idSchema,
    disabled,
    readonly,
    hideError,
    idPrefix,
    idSeparator,
    onBlur,
    onFocus,
    registry,
  } = props;
  const { fields, formContext, schemaUtils, globalUiOptions } = registry;
  const { SchemaField } = fields;
  const schema = schemaUtils.retrieveSchema(rawSchema, formData);
  const uiOptions = getUiOptions<LayoutGridOptions>(uiSchema, globalUiOptions);
  const schemaProperties = (schema.properties ?? {}) as Record<
    string,
    RJSFSchema | boolean
  >;
  const orderedPropertyNames = orderProperties(
    Object.keys(schemaProperties),
    uiOptions.order
  );
  const rows = Array.isArray(uiOptions.rows) ? uiOptions.rows : [];
  const placedFieldNames = new Set(
    rows.reduce<string[]>(
      (acc, row) =>
        Array.isArray(row.columns)
          ? acc.concat(
              row.columns.map((column: LayoutGridColumn) => column.name)
            )
          : acc,
      []
    )
  );

  const renderField = (
    propertyName: string,
    customUiSchema?: UiSchema,
    wrapperClassName?: string
  ) => {
    const fieldSchema = get(schemaProperties, propertyName);

    if (!fieldSchema || typeof fieldSchema === 'boolean') {
      return null;
    }

    const fieldUiSchema = merge(
      {},
      get(uiSchema, propertyName, {}),
      customUiSchema
    );
    const fieldIdSchema = get(idSchema, propertyName) as
      | IdSchema<unknown>
      | undefined;

    if (!fieldIdSchema) {
      return null;
    }

    return (
      <div className={wrapperClassName} key={propertyName}>
        <SchemaField
          disabled={disabled}
          errorSchema={get(errorSchema, propertyName)}
          formContext={formContext}
          formData={get(formData, propertyName)}
          hideError={hideError}
          idPrefix={idPrefix}
          idSchema={fieldIdSchema}
          idSeparator={idSeparator}
          name={propertyName}
          readonly={readonly}
          registry={registry}
          required={
            Array.isArray(schema.required) &&
            schema.required.includes(propertyName)
          }
          schema={fieldSchema}
          uiSchema={fieldUiSchema}
          onBlur={onBlur}
          onChange={(newValue, errorSchemaValue, fieldId) => {
            props.onChange(
              {
                ...(formData as Record<string, unknown>),
                [propertyName]: newValue,
              },
              errorSchemaValue,
              fieldId
            );
          }}
          onDropPropertyClick={() => () => undefined}
          onFocus={onFocus}
          onKeyChange={() => () => undefined}
        />
      </div>
    );
  };

  const unplacedFields = orderedPropertyNames.filter(
    (propertyName) => !placedFieldNames.has(propertyName)
  );

  return (
    <div
      className={getClassName(
        uiOptions.className,
        'tw:flex tw:flex-col tw:gap-4'
      )}>
      {rows.map((row, rowIndex) => (
        <div
          className={getClassName(
            row.className ?? uiOptions.rowClassName,
            'tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2'
          )}
          key={`layout-row-${rowIndex}`}>
          {Array.isArray(row.columns) &&
            row.columns.map((column: LayoutGridColumn) =>
              renderField(column.name, column.uiSchema, column.className)
            )}
        </div>
      ))}

      {unplacedFields.length > 0 && (
        <div
          className={getClassName(
            uiOptions.unplacedFieldsClassName,
            'tw:flex tw:flex-col tw:gap-4'
          )}>
          {unplacedFields.map((propertyName) => renderField(propertyName))}
        </div>
      )}
    </div>
  );
};

export default LayoutGridField;
