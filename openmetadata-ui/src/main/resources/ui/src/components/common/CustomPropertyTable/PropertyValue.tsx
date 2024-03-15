/*
 *  Copyright 2022 Collate.
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

import Icon from '@ant-design/icons';
import {
  DatePicker,
  Form,
  Input,
  Select,
  TimePicker,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isArray, isEmpty, isUndefined, noop, toNumber, toUpper } from 'lodash';
import moment, { Moment } from 'moment';
import React, { FC, Fragment, useState } from 'react';
import { ReactComponent as EditIconComponent } from '../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  VALIDATION_MESSAGES,
} from '../../../constants/constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/entity/type';
import {
  CustomProperty,
  EnumConfig,
} from '../../../generated/type/customProperty';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DataAssetAsyncSelectList from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import InlineEdit from '../InlineEdit/InlineEdit.component';
import RichTextEditorPreviewer from '../RichTextEditor/RichTextEditorPreviewer';
import { PropertyInput } from './PropertyInput';

interface Props {
  versionDataKeys?: string[];
  isVersionView?: boolean;
  property: CustomProperty;
  extension: Table['extension'];
  onExtensionUpdate: (updatedExtension: Table['extension']) => Promise<void>;
  hasEditPermissions: boolean;
}

export const PropertyValue: FC<Props> = ({
  isVersionView,
  versionDataKeys,
  extension,
  onExtensionUpdate,
  hasEditPermissions,
  property,
}) => {
  const propertyName = property.name;
  const propertyType = property.propertyType;

  const value = extension?.[propertyName];

  const [showInput, setShowInput] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onShowInput = () => {
    setShowInput(true);
  };

  const onHideInput = () => {
    setShowInput(false);
  };

  const onInputSave = async (
    updatedValue:
      | string
      | number
      | string[]
      | EntityReference
      | EntityReference[]
  ) => {
    const isEnum = propertyType.name === 'enum';
    const isArrayType = isArray(updatedValue);
    const enumValue = isArrayType ? updatedValue : [updatedValue];
    const propertyValue = isEnum ? enumValue : updatedValue;
    try {
      const updatedExtension = {
        ...(extension || {}),
        [propertyName]:
          propertyType.name === 'integer'
            ? toNumber(updatedValue || 0)
            : propertyValue,
      };
      setIsLoading(true);
      await onExtensionUpdate(updatedExtension);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setShowInput(false);
    }
  };

  const getPropertyInput = () => {
    switch (propertyType.name) {
      case 'string':
      case 'integer':
      case 'number':
        return (
          <PropertyInput
            isLoading={isLoading}
            propertyName={propertyName}
            type={
              ['integer', 'number'].includes(propertyType.name)
                ? 'number'
                : 'text'
            }
            value={value}
            onCancel={onHideInput}
            onSave={onInputSave}
          />
        );
      case 'markdown':
        return (
          <ModalWithMarkdownEditor
            header={t('label.edit-entity-name', {
              entityType: t('label.property'),
              entityName: propertyName,
            })}
            placeholder={t('label.enter-property-value')}
            value={value || ''}
            visible={showInput}
            onCancel={onHideInput}
            onSave={onInputSave}
          />
        );
      case 'enum': {
        const enumConfig = property.customPropertyConfig?.config as EnumConfig;
        const isMultiSelect = Boolean(enumConfig?.multiSelect);
        const options = enumConfig?.values?.map((option) => ({
          label: option,
          value: option,
        }));

        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'enum-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="enum-form"
              initialValues={{
                enumValues: (isArray(value) ? value : [value]).filter(Boolean),
              }}
              layout="vertical"
              onFinish={(values: { enumValues: string | string[] }) =>
                onInputSave(values.enumValues)
              }>
              <Form.Item
                name="enumValues"
                rules={[
                  {
                    required: true,
                    message: t('label.field-required', {
                      field: t('label.enum-value-plural'),
                    }),
                  },
                ]}
                style={{ marginBottom: '0px' }}>
                <Select
                  data-testid="enum-select"
                  disabled={isLoading}
                  mode={isMultiSelect ? 'multiple' : undefined}
                  options={options}
                  placeholder={t('label.enum-value-plural')}
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </Form>
          </InlineEdit>
        );
      }
      case 'date':
      case 'dateTime': {
        const format = toUpper(property.customPropertyConfig?.config as string);

        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'dateTime-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="dateTime-form"
              initialValues={{
                dateTimeValue: value ? moment(value, format) : undefined,
              }}
              layout="vertical"
              onFinish={(values: { dateTimeValue: Moment }) => {
                onInputSave(values.dateTimeValue.format(format));
              }}>
              <Form.Item
                name="dateTimeValue"
                rules={[
                  {
                    required: true,
                    message: t('label.field-required', {
                      field: propertyType.name,
                    }),
                  },
                ]}
                style={{ marginBottom: '0px' }}>
                <DatePicker
                  data-testid="date-time-picker"
                  disabled={isLoading}
                  format={format}
                  showTime={propertyType.name === 'dateTime'}
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </Form>
          </InlineEdit>
        );
      }
      case 'time': {
        const format = 'HH:mm:ss';

        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'time-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="time-form"
              initialValues={{
                time: value ? moment(value, format) : undefined,
              }}
              layout="vertical"
              validateMessages={VALIDATION_MESSAGES}
              onFinish={(values: { time: Moment }) => {
                onInputSave(values.time.format(format));
              }}>
              <Form.Item
                name="time"
                rules={[
                  {
                    required: true,
                  },
                ]}
                style={{ marginBottom: '0px' }}>
                <TimePicker
                  data-testid="time-picker"
                  disabled={isLoading}
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </Form>
          </InlineEdit>
        );
      }
      case 'email': {
        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'email-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="email-form"
              initialValues={{
                email: value,
              }}
              layout="vertical"
              validateMessages={VALIDATION_MESSAGES}
              onFinish={(values: { email: string }) => {
                onInputSave(values.email);
              }}>
              <Form.Item
                name="email"
                rules={[
                  {
                    required: true,
                    min: 6,
                    max: 127,
                    type: 'email',
                  },
                ]}
                style={{ marginBottom: '0px' }}>
                <Input
                  data-testid="email-input"
                  disabled={isLoading}
                  placeholder="john@doe.com"
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </Form>
          </InlineEdit>
        );
      }
      case 'timestamp': {
        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'timestamp-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="timestamp-form"
              initialValues={{
                timestamp: value,
              }}
              layout="vertical"
              onFinish={(values: { timestamp: string }) => {
                onInputSave(toNumber(values.timestamp));
              }}>
              <Form.Item
                help="Timestamp in Unix epoch time milliseconds."
                name="timestamp"
                rules={[
                  {
                    required: true,
                    pattern: /^\d{13}$/,
                  },
                ]}
                style={{ marginBottom: '0px' }}>
                <Input
                  data-testid="timestamp-input"
                  disabled={isLoading}
                  placeholder="Unix epoch time in milliseconds"
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </Form>
          </InlineEdit>
        );
      }
      case 'timeInterval': {
        const timeInterval = JSON.parse(value ?? '{}') as {
          start?: number;
          end?: number;
        };

        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'timeInterval-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="timeInterval-form"
              initialValues={{
                start: timeInterval.start
                  ? timeInterval.start.toString()
                  : undefined,
                end: timeInterval.end ? timeInterval.end.toString() : undefined,
              }}
              layout="vertical"
              onFinish={(values: { start: string; end: string }) => {
                onInputSave(
                  JSON.stringify({
                    start: toNumber(values.start),
                    end: toNumber(values.end),
                  })
                );
              }}>
              <Form.Item
                name="start"
                rules={[
                  {
                    required: true,
                    pattern: /^\d{13}$/,
                  },
                ]}
                style={{ marginBottom: '0px' }}>
                <Input
                  data-testid="start-input"
                  disabled={isLoading}
                  placeholder="Start time in Unix epoch time milliseconds"
                  style={{ width: '250px' }}
                />
              </Form.Item>
              <Form.Item
                name="end"
                rules={[
                  {
                    required: true,
                    pattern: /^\d{13}$/,
                  },
                ]}
                style={{ marginBottom: '0px' }}>
                <Input
                  data-testid="end-input"
                  disabled={isLoading}
                  placeholder="End time in Unix epoch time milliseconds"
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </Form>
          </InlineEdit>
        );
      }
      case 'duration': {
        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'duration-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="duration-form"
              initialValues={{
                duration: value,
              }}
              layout="vertical"
              validateMessages={VALIDATION_MESSAGES}
              onFinish={(values: { duration: string }) => {
                onInputSave(values.duration);
              }}>
              <Form.Item
                name="duration"
                rules={[
                  {
                    required: true,
                  },
                ]}
                style={{ marginBottom: '0px' }}>
                <Input
                  data-testid="duration-input"
                  disabled={isLoading}
                  placeholder='Duration in ISO 8601 format "PnYnMnDTnHnMnS"'
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </Form>
          </InlineEdit>
        );
      }
      case 'sqlQuery': {
        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'sqlQuery-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="sqlQuery-form"
              initialValues={{
                sqlQuery: value,
              }}
              layout="vertical"
              validateMessages={VALIDATION_MESSAGES}
              onFinish={(values: { sqlQuery: string }) => {
                onInputSave(values.sqlQuery);
              }}>
              <Form.Item
                name="sqlQuery"
                rules={[
                  {
                    required: true,
                    message: t('label.field-required', {
                      field: t('label.sql-uppercase-query'),
                    }),
                  },
                ]}
                style={{ marginBottom: '0px' }}
                trigger="onChange">
                <SchemaEditor
                  className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                  mode={{ name: CSMode.SQL }}
                  options={{
                    readOnly: false,
                  }}
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
            initialOptions = value.map((item) => {
              return {
                displayName: getEntityName(item),
                reference: item,
                label: getEntityName(item),
                value: item.id,
              };
            });

            initialValue = value.map((item) => item.id);
          } else {
            initialOptions = [
              {
                displayName: getEntityName(value),
                reference: value,
                label: getEntityName(value),
                value: value.id,
              },
            ];

            initialValue = value.id;
          }
        }

        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'entity-reference-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="entity-reference-form"
              initialValues={{
                entityReference: initialValue,
              }}
              layout="vertical"
              validateMessages={VALIDATION_MESSAGES}
              onFinish={(values: {
                entityReference: DataAssetOption | DataAssetOption[];
              }) => {
                if (isArray(values.entityReference)) {
                  onInputSave(
                    values.entityReference.map((item) => item.reference)
                  );
                } else {
                  onInputSave(values.entityReference.reference);
                }
              }}>
              <Form.Item
                name="entityReference"
                rules={[
                  {
                    required: true,
                  },
                ]}
                style={{ marginBottom: '0px', minWidth: '250px' }}>
                <DataAssetAsyncSelectList
                  initialOptions={initialOptions}
                  mode={mode}
                  placeholder={
                    mode === 'multiple'
                      ? 'Select Entity Reference List'
                      : 'Select Entity Reference'
                  }
                  searchIndex={index.join(',') as SearchIndex}
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

  const getPropertyValue = () => {
    if (isVersionView) {
      const isKeyAdded = versionDataKeys?.includes(propertyName);

      return (
        <RichTextEditorPreviewer
          className={isKeyAdded ? 'diff-added' : ''}
          markdown={String(value) || ''}
        />
      );
    }
    switch (propertyType.name) {
      case 'markdown':
        return <RichTextEditorPreviewer markdown={value || ''} />;

      case 'enum':
        return (
          <Typography.Text className="break-all" data-testid="value">
            {isArray(value) ? value.join(', ') : value}
          </Typography.Text>
        );

      case 'string':
      case 'integer':
      default:
        return (
          <Typography.Text className="break-all" data-testid="value">
            {value}
          </Typography.Text>
        );
    }
  };

  const getValueElement = () => {
    const propertyValue = getPropertyValue();
    const isInteger = propertyType.name === 'integer';
    if (isInteger) {
      return !isUndefined(value) ? (
        propertyValue
      ) : (
        <span className="text-grey-muted" data-testid="no-data">
          {t('message.no-data')}
        </span>
      );
    } else {
      return !isEmpty(value) ? (
        propertyValue
      ) : (
        <span className="text-grey-muted" data-testid="no-data">
          {t('message.no-data')}
        </span>
      );
    }
  };

  return (
    <div>
      {showInput ? (
        getPropertyInput()
      ) : (
        <Fragment>
          <div className="d-flex gap-2 items-center">
            {getValueElement()}
            {hasEditPermissions && (
              <Tooltip
                placement="left"
                title={t('label.edit-entity', { entity: propertyName })}>
                <Icon
                  component={EditIconComponent}
                  data-testid="edit-icon"
                  style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                  onClick={onShowInput}
                />
              </Tooltip>
            )}
          </div>
        </Fragment>
      )}
    </div>
  );
};
