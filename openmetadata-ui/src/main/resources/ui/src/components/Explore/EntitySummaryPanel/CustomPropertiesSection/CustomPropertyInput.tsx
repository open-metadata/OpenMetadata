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

import { Form, Input, Select, TimePicker } from 'antd';
import { isArray, isString, isUndefined, noop, omitBy, toNumber } from 'lodash';
import { DateTime } from 'luxon';
import moment, { Moment } from 'moment';
import { CSSProperties, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../../constants/constants';
import { TABLE_TYPE_CUSTOM_PROPERTY } from '../../../../constants/CustomProperty.constants';
import { TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX } from '../../../../constants/regex.constants';
import { CSMode } from '../../../../enums/codemirror.enum';
import {
  CustomProperty,
  EntityReference,
} from '../../../../generated/entity/type';
import { Config } from '../../../../generated/type/customProperty';
import { getCustomPropertyLuxonFormat } from '../../../../utils/CustomProperty.utils';
import DataAssetAsyncSelectList from '../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { ModalWithMarkdownEditor } from '../../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import DatePicker from '../../../common/DatePicker/DatePicker';
import InlineEdit from '../../../common/InlineEdit/InlineEdit.component';
import { TimeIntervalType } from '../../../common/CustomPropertyTable/CustomPropertyTable.interface';
import { PropertyInput } from '../../../common/CustomPropertyTable/PropertyInput';
import EditTableTypePropertyModal from '../../../common/CustomPropertyTable/TableTypeProperty/EditTableTypePropertyModal';
import TableTypePropertyView from '../../../common/CustomPropertyTable/TableTypeProperty/TableTypePropertyView';
import SchemaEditor from '../../../Database/SchemaEditor/SchemaEditor';

const CustomPropertyInput: FC<{
  property: CustomProperty;
  value: any;
  onHideInput: () => void;
  onInputSave: (value: any) => Promise<void>;
  isLoading: boolean;
}> = ({ property, value, onHideInput, onInputSave, isLoading }) => {
  const { t } = useTranslation();
  const propertyType = property.propertyType;
  const propertyName = property.name;

  const commonStyle: CSSProperties = {
    marginBottom: '0px',
    width: '100%',
  };

  const findOptionReference = (
    item: DataAssetOption | string,
    options: DataAssetOption[]
  ) => {
    if (isString(item)) {
      return options.find((option) => option.value === item)?.reference;
    }

    return item?.reference;
  };

  switch (propertyType.name) {
    case 'string':
    case 'integer':
    case 'number': {
      const inputType = ['integer', 'number'].includes(propertyType.name)
        ? 'number'
        : 'text';

      return (
        <PropertyInput
          isLoading={isLoading}
          propertyName={propertyName}
          type={inputType}
          value={value}
          onCancel={onHideInput}
          onSave={onInputSave}
        />
      );
    }

    case 'markdown': {
      const header = t('label.edit-entity-name', {
        entityType: t('label.property'),
        entityName: property.displayName || property.name,
      });

      return (
        <ModalWithMarkdownEditor
          visible
          header={header}
          placeholder={t('label.enter-property-value')}
          value={value ?? ''}
          onCancel={onHideInput}
          onSave={onInputSave}
        />
      );
    }

    case 'enum': {
      const enumConfig = property.customPropertyConfig?.config as Config;
      const isMultiSelect = Boolean(enumConfig?.multiSelect);
      const options = enumConfig?.values?.map((option) => ({
        label: option,
        value: option,
      }));

      const initialValues = {
        enumValues: (isArray(value) ? value : [value]).filter(Boolean),
      };

      const formId = `enum-form-${propertyName}`;

      return (
        <InlineEdit
          className="custom-property-inline-edit-container"
          isLoading={isLoading}
          saveButtonProps={{
            disabled: isLoading,
            htmlType: 'submit',
            form: formId,
          }}
          onCancel={onHideInput}
          onSave={noop}>
          <Form
            id={formId}
            initialValues={initialValues}
            layout="vertical"
            onFinish={(values: { enumValues: string | string[] }) =>
              onInputSave(values.enumValues)
            }>
            <Form.Item name="enumValues" style={commonStyle}>
              <Select
                allowClear
                data-testid="enum-select"
                disabled={isLoading}
                mode={isMultiSelect ? 'multiple' : undefined}
                options={options}
                placeholder={t('label.enum-value-plural')}
              />
            </Form.Item>
          </Form>
        </InlineEdit>
      );
    }

    case 'date-cp':
    case 'dateTime-cp': {
      const format = getCustomPropertyLuxonFormat(
        propertyType.name,
        property.customPropertyConfig?.config
      );

      const initialValues = {
        dateTimeValue: value ? DateTime.fromFormat(value, format) : undefined,
      };

      const formId = `dateTime-form-${propertyName}`;

      return (
        <InlineEdit
          className="custom-property-inline-edit-container"
          isLoading={isLoading}
          saveButtonProps={{
            disabled: isLoading,
            htmlType: 'submit',
            form: formId,
          }}
          onCancel={onHideInput}
          onSave={noop}>
          <Form
            id={formId}
            initialValues={initialValues}
            layout="vertical"
            onFinish={(values: { dateTimeValue: DateTime }) => {
              onInputSave(
                values.dateTimeValue
                  ? values.dateTimeValue.toFormat(format)
                  : values.dateTimeValue // If date is cleared and set undefined
              );
            }}>
            <Form.Item name="dateTimeValue" style={commonStyle}>
              <DatePicker
                allowClear
                className="w-full"
                data-testid="date-time-picker"
                disabled={isLoading}
                format={format}
                showTime={propertyType.name === 'dateTime-cp'}
              />
            </Form.Item>
          </Form>
        </InlineEdit>
      );
    }

    case 'time-cp': {
      const format = getCustomPropertyLuxonFormat(
        propertyType.name,
        property.customPropertyConfig?.config
      );

      const initialValues = {
        time: value ? moment(value, format) : undefined,
      };

      const formId = `time-form-${propertyName}`;

      return (
        <InlineEdit
          className="custom-property-inline-edit-container"
          isLoading={isLoading}
          saveButtonProps={{
            disabled: isLoading,
            htmlType: 'submit',
            form: formId,
          }}
          onCancel={onHideInput}
          onSave={noop}>
          <Form
            id={formId}
            initialValues={initialValues}
            layout="vertical"
            validateMessages={VALIDATION_MESSAGES}
            onFinish={(values: { time: Moment }) => {
              onInputSave(
                values.time ? values.time.format(format) : values.time // If time is cleared and set undefined
              );
            }}>
            <Form.Item name="time" style={commonStyle}>
              <TimePicker
                allowClear
                className="w-full"
                data-testid="time-picker"
                disabled={isLoading}
                format={format}
              />
            </Form.Item>
          </Form>
        </InlineEdit>
      );
    }

    case 'email': {
      const initialValues = {
        email: value,
      };

      const formId = `email-form-${propertyName}`;

      return (
        <InlineEdit
          className="custom-property-inline-edit-container"
          isLoading={isLoading}
          saveButtonProps={{
            disabled: isLoading,
            htmlType: 'submit',
            form: formId,
          }}
          onCancel={onHideInput}
          onSave={noop}>
          <Form
            id={formId}
            initialValues={initialValues}
            layout="vertical"
            validateMessages={VALIDATION_MESSAGES}
            onFinish={(values: { email: string }) => {
              onInputSave(values.email);
            }}>
            <Form.Item
              name="email"
              rules={[
                {
                  min: 6,
                  max: 127,
                  type: 'email',
                },
              ]}
              style={commonStyle}>
              <Input
                allowClear
                data-testid="email-input"
                disabled={isLoading}
                placeholder="john@doe.com"
              />
            </Form.Item>
          </Form>
        </InlineEdit>
      );
    }

    case 'timestamp': {
      const initialValues = {
        timestamp: value,
      };

      const formId = `timestamp-form-${propertyName}`;

      return (
        <InlineEdit
          className="custom-property-inline-edit-container"
          isLoading={isLoading}
          saveButtonProps={{
            disabled: isLoading,
            htmlType: 'submit',
            form: formId,
          }}
          onCancel={onHideInput}
          onSave={noop}>
          <Form
            id={formId}
            initialValues={initialValues}
            layout="vertical"
            onFinish={(values: { timestamp: string }) => {
              onInputSave(
                values.timestamp ? toNumber(values.timestamp) : values.timestamp // If timestamp is cleared and set undefined
              );
            }}>
            <Form.Item
              name="timestamp"
              rules={[
                {
                  pattern: TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX,
                  message: t('message.invalid-unix-epoch-time-milliseconds'),
                },
              ]}
              style={commonStyle}>
              <Input
                allowClear
                data-testid="timestamp-input"
                disabled={isLoading}
                placeholder={t('message.unix-epoch-time-in-ms', {
                  prefix: '',
                })}
              />
            </Form.Item>
          </Form>
        </InlineEdit>
      );
    }

    case 'timeInterval': {
      const initialValues = {
        start: value?.start ? value.start?.toString() : undefined,
        end: value?.end ? value.end?.toString() : undefined,
      };

      const formId = `timeInterval-form-${propertyName}`;

      return (
        <InlineEdit
          className="custom-property-inline-edit-container"
          isLoading={isLoading}
          saveButtonProps={{
            disabled: isLoading,
            htmlType: 'submit',
            form: formId,
          }}
          onCancel={onHideInput}
          onSave={noop}>
          <Form
            id={formId}
            initialValues={initialValues}
            layout="vertical"
            onFinish={(values: { start: string; end: string }) => {
              onInputSave(
                omitBy(
                  {
                    start: values.start ? toNumber(values.start) : values.start,
                    end: values.end ? toNumber(values.end) : values.end,
                  },
                  isUndefined
                ) as TimeIntervalType
              );
            }}>
            <Form.Item
              name="start"
              rules={[
                {
                  pattern: TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX,
                  message: t('message.invalid-unix-epoch-time-milliseconds'),
                },
              ]}
              style={{ ...commonStyle, marginBottom: '16px' }}>
              <Input
                allowClear
                data-testid="start-input"
                disabled={isLoading}
                placeholder={t('message.unix-epoch-time-in-ms', {
                  prefix: 'Start',
                })}
              />
            </Form.Item>
            <Form.Item
              name="end"
              rules={[
                {
                  pattern: TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX,
                  message: t('message.invalid-unix-epoch-time-milliseconds'),
                },
              ]}
              style={commonStyle}>
              <Input
                allowClear
                data-testid="end-input"
                disabled={isLoading}
                placeholder={t('message.unix-epoch-time-in-ms', {
                  prefix: 'End',
                })}
              />
            </Form.Item>
          </Form>
        </InlineEdit>
      );
    }

    case 'duration': {
      const initialValues = {
        duration: value,
      };

      const formId = `duration-form-${propertyName}`;

      return (
        <InlineEdit
          className="custom-property-inline-edit-container"
          isLoading={isLoading}
          saveButtonProps={{
            disabled: isLoading,
            htmlType: 'submit',
            form: formId,
          }}
          onCancel={onHideInput}
          onSave={noop}>
          <Form
            id={formId}
            initialValues={initialValues}
            layout="vertical"
            validateMessages={VALIDATION_MESSAGES}
            onFinish={(values: { duration: string }) => {
              onInputSave(values.duration);
            }}>
            <Form.Item name="duration" style={commonStyle}>
              <Input
                allowClear
                data-testid="duration-input"
                disabled={isLoading}
                placeholder={t('message.duration-in-iso-format')}
              />
            </Form.Item>
          </Form>
        </InlineEdit>
      );
    }

    case 'entityReference':
    case 'entityReferenceList': {
      const mode =
        propertyType.name === 'entityReferenceList' ? 'multiple' : undefined;

      const index = (property.customPropertyConfig?.config as string[]) ?? [];

      let initialOptions: DataAssetOption[] = [];
      let initialValue: string[] | string | undefined;

      if (!isUndefined(value)) {
        if (isArray(value)) {
          initialOptions = value.map((item: EntityReference) => {
            return {
              displayName: item.displayName || item.name || '',
              reference: item,
              label: item.displayName || item.name || '',
              value: item?.fullyQualifiedName ?? '',
            };
          });

          initialValue = value.map(
            (item: EntityReference) => item?.fullyQualifiedName ?? ''
          );
        } else {
          initialOptions = [
            {
              displayName: value.displayName || value.name || '',
              reference: value,
              label: value.displayName || value.name || '',
              value: value?.fullyQualifiedName ?? '',
            },
          ];

          initialValue = value?.fullyQualifiedName ?? '';
        }
      }

      const initialValues = {
        entityReference: initialValue,
      };

      const formId = `entity-reference-form-${propertyName}`;

      return (
        <InlineEdit
          className="custom-property-inline-edit-container"
          isLoading={isLoading}
          saveButtonProps={{
            disabled: isLoading,
            htmlType: 'submit',
            form: formId,
          }}
          onCancel={onHideInput}
          onSave={noop}>
          <Form
            id={formId}
            initialValues={initialValues}
            layout="vertical"
            validateMessages={VALIDATION_MESSAGES}
            onFinish={(values: {
              entityReference: DataAssetOption | DataAssetOption[];
            }) => {
              const { entityReference } = values;

              if (Array.isArray(entityReference)) {
                const references = entityReference
                  .map((item) => findOptionReference(item, initialOptions))
                  .filter(Boolean) as EntityReference[];
                onInputSave(references);

                return;
              }

              const reference = findOptionReference(
                entityReference,
                initialOptions
              );
              onInputSave(reference as EntityReference);
            }}>
            <Form.Item name="entityReference" style={commonStyle}>
              <DataAssetAsyncSelectList
                initialOptions={initialOptions}
                mode={mode}
                placeholder={
                  mode === 'multiple'
                    ? t('label.entity-reference')
                    : t('label.entity-reference-plural')
                }
                searchIndex={index.join(',') as any}
              />
            </Form.Item>
          </Form>
        </InlineEdit>
      );
    }

    case TABLE_TYPE_CUSTOM_PROPERTY: {
      const config = property.customPropertyConfig?.config as Config;
      const columns = config?.columns ?? [];
      const rows = value?.rows ?? [];

      return (
        <>
          <TableTypePropertyView columns={columns} rows={rows} />
          <EditTableTypePropertyModal
            isVisible
            columns={columns}
            isUpdating={isLoading}
            property={property}
            rows={value?.rows ?? []}
            onCancel={onHideInput}
            onSave={onInputSave}
          />
        </>
      );
    }

    case 'sqlQuery': {
      const initialValues = {
        sqlQuery: value,
      };

      const formId = `sqlQuery-form-${propertyName}`;

      return (
        <InlineEdit
          className="custom-property-inline-edit-container sql-query-custom-property"
          isLoading={isLoading}
          saveButtonProps={{
            disabled: isLoading,
            htmlType: 'submit',
            form: formId,
          }}
          onCancel={onHideInput}
          onSave={noop}>
          <Form
            id={formId}
            initialValues={initialValues}
            layout="vertical"
            validateMessages={VALIDATION_MESSAGES}
            onFinish={(values: { sqlQuery: string }) => {
              onInputSave(values.sqlQuery);
            }}>
            <Form.Item name="sqlQuery" style={commonStyle} trigger="onChange">
              <SchemaEditor
                className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                mode={{ name: CSMode.SQL }}
                showCopyButton={false}
              />
            </Form.Item>
          </Form>
        </InlineEdit>
      );
    }

    default:
      return null;
  }
};

export default CustomPropertyInput;
