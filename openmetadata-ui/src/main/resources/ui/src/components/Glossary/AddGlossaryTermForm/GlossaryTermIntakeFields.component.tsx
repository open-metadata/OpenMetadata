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

import { Button, Form, Input, InputNumber, Select, TimePicker } from 'antd';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import moment, { Moment } from 'moment';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HYPERLINK_TYPE_CUSTOM_PROPERTY,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../constants/CustomProperty.constants';
import { TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX } from '../../../constants/regex.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { Config, CustomProperty } from '../../../generated/entity/type';
import { IntakeFormField } from '../../../generated/governance/intakeForm';
import { useGridEditController } from '../../../hooks/useGridEditController';
import {
  filterPopulatedTableRows,
  formatCustomPropertyDateTime,
  getCustomPropertyLuxonFormat,
  getCustomPropertyMomentFormat,
  getCustomPropertyReferenceSearchIndex,
  getHyperlinkUrlValidationErrorKey,
  hasPopulatedTableRows,
  parseCustomPropertyDateTime,
} from '../../../utils/CustomProperty.utils';
import { getGridColumns } from '../../common/CustomPropertyTable/TableTypeProperty/EditTableTypePropertyModal';
import TableTypePropertyEditTable from '../../common/CustomPropertyTable/TableTypeProperty/TableTypePropertyEditTable';
import CustomPropertyTypeBadge from '../../common/CustomPropertyTypeBadge/CustomPropertyTypeBadge.component';
import DatePicker from '../../common/DatePicker/DatePicker';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import DataAssetAsyncSelectList from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';

interface GlossaryTermIntakeFieldsProps {
  customProperties: CustomProperty[];
  formFields: IntakeFormField[];
}

interface TablePropertyValue {
  columns: string[];
  rows: Record<string, string>[];
}

interface TablePropertyInputProps {
  columns: string[];
  onChange?: (value: TablePropertyValue) => void;
  value?: TablePropertyValue;
}

interface TextEditorInputProps {
  dataTestId: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
}

const getExtensionName = (fieldPath: string) =>
  fieldPath.startsWith('extension.')
    ? fieldPath.slice('extension.'.length)
    : fieldPath;

const GlossaryTablePropertyInput = ({
  columns,
  onChange,
  value,
}: TablePropertyInputProps) => {
  const { t } = useTranslation();
  const hasMounted = useRef(false);
  const onChangeRef = useRef(onChange);
  const [dataSource, setDataSource] = useState<Record<string, string>[]>(
    () => value?.rows.map((row) => ({ ...row })) ?? []
  );
  const gridColumns = useMemo(() => getGridColumns(columns), [columns]);
  const {
    handleCopy,
    handlePaste: handleGridPaste,
    handleOnRowsChange,
    setGridContainer,
    handleAddRow,
  } = useGridEditController({
    columns: gridColumns,
    dataSource,
    rowIdKey: null,
    setDataSource,
  });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (hasMounted.current) {
      const rows = filterPopulatedTableRows(dataSource);
      onChangeRef.current?.({ columns, rows });
    } else {
      hasMounted.current = true;
    }
  }, [columns, dataSource]);

  const handlePaste = handleGridPaste as unknown as () => Record<
    string,
    string
  >;

  return (
    <div data-testid="table-property-input">
      <Button
        className="m-b-sm"
        data-testid="add-new-row"
        type="primary"
        onClick={handleAddRow}>
        {t('label.add-entity', { entity: t('label.row') })}
      </Button>
      {!isEmpty(dataSource) && (
        <TableTypePropertyEditTable
          columns={gridColumns}
          dataSource={dataSource}
          handleCopy={handleCopy}
          handleOnRowsChange={handleOnRowsChange}
          handlePaste={handlePaste}
          setGridContainer={setGridContainer}
        />
      )}
    </div>
  );
};

const GlossaryMarkdownInput = ({
  dataTestId,
  onChange,
  placeholder,
  value,
}: TextEditorInputProps) => (
  <div data-testid={dataTestId}>
    <RichTextEditor
      initialValue={value}
      placeHolder={placeholder}
      onTextChange={onChange}
    />
  </div>
);

const GlossarySqlQueryInput = ({
  dataTestId,
  onChange,
  value,
}: TextEditorInputProps) => (
  <div data-testid={dataTestId}>
    <SchemaEditor
      className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
      mode={{ name: CSMode.SQL }}
      showCopyButton={false}
      value={value}
      onChange={onChange}
    />
  </div>
);

const GlossaryTermIntakeFields = ({
  customProperties,
  formFields,
}: GlossaryTermIntakeFieldsProps) => {
  const { t } = useTranslation();
  const definitions = useMemo(
    () =>
      new Map(customProperties.map((property) => [property.name, property])),
    [customProperties]
  );

  const getTimestampRule = useCallback(
    () => ({
      validator: (_: unknown, value: number | undefined) => {
        if (
          value === undefined ||
          TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX.test(String(value))
        ) {
          return Promise.resolve();
        }

        return Promise.reject(
          new Error(t('message.invalid-unix-epoch-time-milliseconds'))
        );
      },
    }),
    [t]
  );

  return (
    <>
      {formFields.map((field) => {
        const propertyName = getExtensionName(field.fieldPath);
        const definition = definitions.get(propertyName);
        const propertyType = definition?.propertyType.name ?? 'string';
        const dataTestId = `extension-${propertyName}`;
        const name = ['extension', propertyName];
        const isRequired = Boolean(field.required);
        const requiredMessage =
          field.errorMessage ||
          t('label.field-required', { field: field.fieldLabel });
        const requiredRules = isRequired
          ? [{ required: true, message: requiredMessage }]
          : [];
        const labelNode = definition ? (
          <span className="d-inline-flex items-center gap-2">
            {field.fieldLabel}
            <CustomPropertyTypeBadge
              propertyTypeName={definition.propertyType.name}
            />
          </span>
        ) : (
          field.fieldLabel
        );

        switch (propertyType) {
          case 'integer':
          case 'number':
            return (
              <Form.Item
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={requiredRules}>
                <InputNumber
                  className="w-full"
                  data-testid={dataTestId}
                  precision={propertyType === 'integer' ? 0 : undefined}
                />
              </Form.Item>
            );
          case 'enum': {
            const config = definition?.customPropertyConfig?.config as
              | Config
              | undefined;

            return (
              <Form.Item
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={requiredRules}>
                <Select
                  allowClear
                  data-testid={dataTestId}
                  mode={config?.multiSelect ? 'multiple' : undefined}
                  options={config?.values?.map((value) => ({
                    label: value,
                    value,
                  }))}
                  placeholder={t('label.enum-value-plural')}
                />
              </Form.Item>
            );
          }
          case 'entityReference':
          case 'entityReferenceList':
            return definition ? (
              <Form.Item
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={requiredRules}>
                <DataAssetAsyncSelectList
                  data-testid={dataTestId}
                  mode={
                    propertyType === 'entityReferenceList'
                      ? 'multiple'
                      : undefined
                  }
                  placeholder={t('label.enter-entity')}
                  searchIndex={getCustomPropertyReferenceSearchIndex(
                    definition
                  )}
                />
              </Form.Item>
            ) : null;
          case HYPERLINK_TYPE_CUSTOM_PROPERTY:
            return (
              <div data-testid={dataTestId} key={field.fieldPath}>
                <Form.Item
                  label={labelNode}
                  name={[...name, 'url']}
                  required={isRequired}
                  rules={[
                    ...requiredRules,
                    {
                      validator: (_: unknown, value: string | undefined) => {
                        const errorKey =
                          getHyperlinkUrlValidationErrorKey(value);

                        return errorKey
                          ? Promise.reject(new Error(t(errorKey)))
                          : Promise.resolve();
                      },
                    },
                  ]}>
                  <Input
                    allowClear
                    data-testid={`${dataTestId}-url`}
                    placeholder={t('label.url-uppercase')}
                  />
                </Form.Item>
                <Form.Item
                  label={t('label.display-text')}
                  name={[...name, 'displayText']}>
                  <Input
                    allowClear
                    data-testid={`${dataTestId}-displayText`}
                    placeholder={t('label.display-text')}
                  />
                </Form.Item>
              </div>
            );
          case 'markdown':
            return (
              <Form.Item
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={requiredRules}>
                <GlossaryMarkdownInput
                  dataTestId={dataTestId}
                  placeholder={t('label.enter-property-value')}
                />
              </Form.Item>
            );
          case 'date-cp':
          case 'dateTime-cp': {
            const format = getCustomPropertyLuxonFormat(
              propertyType,
              definition?.customPropertyConfig?.config
            );

            return (
              <Form.Item
                getValueFromEvent={(value: DateTime | null) =>
                  value
                    ? formatCustomPropertyDateTime(
                        value,
                        propertyType,
                        definition?.customPropertyConfig?.config
                      )
                    : undefined
                }
                getValueProps={(value: string | undefined) => ({
                  value: value
                    ? parseCustomPropertyDateTime(
                        value,
                        propertyType,
                        definition?.customPropertyConfig?.config
                      )
                    : null,
                })}
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={requiredRules}>
                <DatePicker
                  allowClear
                  className="w-full"
                  data-testid={dataTestId}
                  format={format}
                  showTime={propertyType === 'dateTime-cp'}
                />
              </Form.Item>
            );
          }
          case 'time-cp': {
            const format = getCustomPropertyMomentFormat(
              propertyType,
              definition?.customPropertyConfig?.config
            );

            return (
              <Form.Item
                getValueFromEvent={(value: Moment | null) =>
                  value?.format(format)
                }
                getValueProps={(value: string | undefined) => ({
                  value: value ? moment(value, format) : null,
                })}
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={requiredRules}>
                <TimePicker
                  allowClear
                  className="w-full"
                  data-testid={dataTestId}
                  format={format}
                />
              </Form.Item>
            );
          }
          case 'timestamp':
            return (
              <Form.Item
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={[...requiredRules, getTimestampRule()]}>
                <InputNumber
                  className="w-full"
                  data-testid={dataTestId}
                  placeholder={t('message.unix-epoch-time-in-ms', {
                    prefix: '',
                  })}
                  precision={0}
                />
              </Form.Item>
            );
          case 'timeInterval':
            return (
              <div data-testid={dataTestId} key={field.fieldPath}>
                <Form.Item
                  label={labelNode}
                  name={[...name, 'start']}
                  required={isRequired}
                  rules={[...requiredRules, getTimestampRule()]}>
                  <InputNumber
                    className="w-full"
                    data-testid={`${dataTestId}-start`}
                    placeholder={t('message.unix-epoch-time-in-ms', {
                      prefix: t('label.start'),
                    })}
                    precision={0}
                  />
                </Form.Item>
                <Form.Item
                  label={t('label.end')}
                  name={[...name, 'end']}
                  required={isRequired}
                  rules={[...requiredRules, getTimestampRule()]}>
                  <InputNumber
                    className="w-full"
                    data-testid={`${dataTestId}-end`}
                    placeholder={t('message.unix-epoch-time-in-ms', {
                      prefix: t('label.end'),
                    })}
                    precision={0}
                  />
                </Form.Item>
              </div>
            );
          case 'sqlQuery':
            return (
              <Form.Item
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={requiredRules}>
                <GlossarySqlQueryInput dataTestId={dataTestId} />
              </Form.Item>
            );
          case TABLE_TYPE_CUSTOM_PROPERTY: {
            const config = definition?.customPropertyConfig?.config as
              | Config
              | undefined;

            return (
              <div data-testid={dataTestId} key={field.fieldPath}>
                <Form.Item
                  label={labelNode}
                  name={name}
                  required={isRequired}
                  rules={[
                    {
                      validator: (_: unknown, value: unknown) =>
                        hasPopulatedTableRows(value) || !isRequired
                          ? Promise.resolve()
                          : Promise.reject(new Error(requiredMessage)),
                    },
                  ]}>
                  <GlossaryTablePropertyInput columns={config?.columns ?? []} />
                </Form.Item>
              </div>
            );
          }
          case 'email':
            return (
              <Form.Item
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={[
                  ...requiredRules,
                  {
                    max: 127,
                    min: 6,
                    type: 'email',
                  },
                ]}>
                <Input
                  allowClear
                  data-testid={dataTestId}
                  placeholder={t('label.email')}
                />
              </Form.Item>
            );
          case 'duration':
            return (
              <Form.Item
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={requiredRules}>
                <Input
                  allowClear
                  data-testid={dataTestId}
                  placeholder={t('message.duration-in-iso-format')}
                />
              </Form.Item>
            );
          case 'string':
          default:
            return (
              <Form.Item
                key={field.fieldPath}
                label={labelNode}
                name={name}
                required={isRequired}
                rules={requiredRules}>
                <Input
                  allowClear
                  data-testid={dataTestId}
                  placeholder={field.fieldLabel}
                />
              </Form.Item>
            );
        }
      })}
    </>
  );
};

export default GlossaryTermIntakeFields;
