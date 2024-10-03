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

import Icon, { DownOutlined, UpOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import {
  isArray,
  isEmpty,
  isNil,
  isUndefined,
  noop,
  omitBy,
  toNumber,
  toUpper,
} from 'lodash';
import moment, { Moment } from 'moment';
import React, {
  CSSProperties,
  FC,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIconComponent } from '../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  VALIDATION_MESSAGES,
} from '../../../constants/constants';
import {
  ENUM_WITH_DESCRIPTION,
  INLINE_PROPERTY_TYPES,
} from '../../../constants/CustomProperty.constants';
import { TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX } from '../../../constants/regex.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { EnumConfig, ValueClass } from '../../../generated/type/customProperty';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import DataAssetAsyncSelectList from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import InlineEdit from '../InlineEdit/InlineEdit.component';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from '../RichTextEditor/RichTextEditorPreviewer';
import Table from '../Table/Table';
import {
  PropertyValueProps,
  PropertyValueType,
  TimeIntervalType,
} from './CustomPropertyTable.interface';
import './property-value.less';
import { PropertyInput } from './PropertyInput';

export const PropertyValue: FC<PropertyValueProps> = ({
  isVersionView,
  versionDataKeys,
  extension,
  onExtensionUpdate,
  hasEditPermissions,
  property,
  isRenderedInRightPanel = false,
}) => {
  const { propertyName, propertyType, value, isInlineProperty } =
    useMemo(() => {
      const propertyName = property.name;
      const propertyType = property.propertyType;
      const isInlineProperty = INLINE_PROPERTY_TYPES.includes(
        propertyType.name ?? ''
      );

      const value = extension?.[propertyName];

      return {
        propertyName,
        propertyType,
        value,
        isInlineProperty,
      };
    }, [property, extension]);

  const [showInput, setShowInput] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const onShowInput = () => setShowInput(true);

  const onHideInput = () => setShowInput(false);

  const findOptionReference = (
    item: DataAssetOption | string,
    options: DataAssetOption[]
  ) => {
    if (typeof item === 'string') {
      const option = options.find((option) => option.value === item);

      return option?.reference;
    }

    return item?.reference;
  };

  const onInputSave = async (updatedValue: PropertyValueType) => {
    const isEnum = propertyType.name === 'enum';
    const isEnumWithDescription = propertyType.name === ENUM_WITH_DESCRIPTION;

    const isArrayType = isArray(updatedValue);

    const enumValue = isArrayType ? updatedValue : [updatedValue];

    const propertyValue =
      isEnum || isEnumWithDescription
        ? (enumValue as string[]).filter(Boolean)
        : updatedValue;

    try {
      // Omit undefined and empty values
      const updatedExtension = omitBy(
        omitBy(
          {
            ...(extension ?? {}),
            [propertyName]: ['integer', 'number'].includes(
              propertyType.name ?? ''
            )
              ? updatedValue
                ? toNumber(updatedValue)
                : updatedValue // If number is cleared and set undefined
              : propertyValue,
          },
          isUndefined
        ),
        (value) =>
          // Check if value is empty array, empty string, null or empty object
          value === '' ||
          isNil(value) ||
          (typeof value === 'object' && isEmpty(value))
      );

      setIsLoading(true);

      await onExtensionUpdate(
        // If updatedExtension is empty, set it to undefined
        isEmpty(updatedExtension) ? undefined : updatedExtension
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setShowInput(false);
    }
  };

  const getPropertyInput = () => {
    const commonStyle: CSSProperties = {
      marginBottom: '0px',
      minWidth: '250px',
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
          entityName: propertyName,
        });

        return (
          <ModalWithMarkdownEditor
            header={header}
            placeholder={t('label.enter-property-value')}
            value={value || ''}
            visible={showInput}
            onCancel={onHideInput}
            onSave={onInputSave}
          />
        );
      }

      case 'enum': {
        const enumConfig = property.customPropertyConfig?.config as EnumConfig;

        const isMultiSelect = Boolean(enumConfig?.multiSelect);

        const options = enumConfig?.values?.map((option) => ({
          label: option,
          value: option,
        }));

        const initialValues = {
          enumValues: (isArray(value) ? value : [value]).filter(Boolean),
        };

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

      case ENUM_WITH_DESCRIPTION: {
        const enumConfig = property.customPropertyConfig?.config as EnumConfig;

        const isMultiSelect = Boolean(enumConfig?.multiSelect);

        const values = (enumConfig?.values as ValueClass[]) ?? [];

        const options = values.map((option) => ({
          label: (
            <Tooltip title={option.description}>
              <span>{option.key}</span>
            </Tooltip>
          ),
          value: option.key,
        }));

        const initialValues = {
          enumWithDescriptionValues: (isArray(value) ? value : [value]).filter(
            Boolean
          ),
        };

        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'enum-with-description-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="enum-with-description-form"
              initialValues={initialValues}
              layout="vertical"
              onFinish={(values: {
                enumWithDescriptionValues: string | string[];
              }) => onInputSave(values.enumWithDescriptionValues)}>
              <Form.Item name="enumWithDescriptionValues" style={commonStyle}>
                <Select
                  allowClear
                  data-testid="enum-with-description-select"
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
        // Default format is 'yyyy-mm-dd'
        const format = toUpper(
          (property.customPropertyConfig?.config as string) ?? 'yyyy-mm-dd'
        );

        const initialValues = {
          dateTimeValue: value ? moment(value, format) : undefined,
        };

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
              initialValues={initialValues}
              layout="vertical"
              onFinish={(values: { dateTimeValue: Moment }) => {
                onInputSave(
                  values.dateTimeValue
                    ? values.dateTimeValue.format(format)
                    : values.dateTimeValue // If date is cleared and set undefined
                );
              }}>
              <Form.Item name="dateTimeValue" style={commonStyle}>
                <DatePicker
                  allowClear
                  data-testid="date-time-picker"
                  disabled={isLoading}
                  format={format}
                  showTime={propertyType.name === 'dateTime-cp'}
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </Form>
          </InlineEdit>
        );
      }

      case 'time-cp': {
        const format =
          (property.customPropertyConfig?.config as string) ?? 'HH:mm:ss';
        const initialValues = {
          time: value ? moment(value, format) : undefined,
        };

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
                  data-testid="time-picker"
                  disabled={isLoading}
                  format={format}
                  style={{ width: '250px' }}
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
              initialValues={initialValues}
              layout="vertical"
              onFinish={(values: { timestamp: string }) => {
                onInputSave(
                  values.timestamp
                    ? toNumber(values.timestamp)
                    : values.timestamp // If timestamp is cleared and set undefined
                );
              }}>
              <Form.Item
                name="timestamp"
                rules={[
                  {
                    pattern: TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX,
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
              initialValues={initialValues}
              layout="vertical"
              onFinish={(values: { start: string; end: string }) => {
                onInputSave(
                  omitBy(
                    {
                      start: values.start
                        ? toNumber(values.start)
                        : values.start,
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

      case 'sqlQuery': {
        const initialValues = {
          sqlQuery: value,
        };

        return (
          <InlineEdit
            className="sql-query-custom-property"
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
                displayName: getEntityName(item),
                reference: item,
                label: getEntityName(item),
                value: item?.fullyQualifiedName ?? '',
              };
            });

            initialValue = value.map(
              (item: EntityReference) => item?.fullyQualifiedName ?? ''
            );
          } else {
            initialOptions = [
              {
                displayName: getEntityName(value),
                reference: value,
                label: getEntityName(value),
                value: value?.fullyQualifiedName ?? '',
              },
            ];

            initialValue = value?.fullyQualifiedName ?? '';
          }
        }

        const initialValues = {
          entityReference: initialValue,
        };

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
          <>
            {isArray(value) ? (
              <div
                className="w-full d-flex gap-2 flex-wrap"
                data-testid="enum-value">
                {value.map((val) => (
                  <Tooltip key={val} title={val} trigger="hover">
                    <Tag className="enum-key-tag">{val}</Tag>
                  </Tooltip>
                ))}
              </div>
            ) : (
              <Tooltip key={value} title={value} trigger="hover">
                <Tag className="enum-key-tag" data-testid="enum-value">
                  {value}
                </Tag>
              </Tooltip>
            )}
          </>
        );

      case ENUM_WITH_DESCRIPTION: {
        const enumWithDescriptionValues = (value as ValueClass[]) ?? [];

        const columns: ColumnsType<ValueClass> = [
          {
            title: 'Key',
            dataIndex: 'key',
            key: 'key',
            render: (key: string) => <Typography>{key}</Typography>,
          },
          {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
            render: (description: string) => (
              <RichTextEditorPreviewer markdown={description || ''} />
            ),
          },
        ];

        return (
          <Table
            bordered
            resizableColumns
            className="w-full"
            columns={columns}
            data-testid="enum-with-description-table"
            dataSource={enumWithDescriptionValues}
            pagination={false}
            rowKey="name"
            scroll={isRenderedInRightPanel ? { x: true } : undefined}
            size="small"
          />
        );
      }

      case 'sqlQuery':
        return (
          <SchemaEditor
            className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
            mode={{ name: CSMode.SQL }}
            options={{
              readOnly: true,
            }}
            value={value ?? ''}
          />
        );
      case 'entityReferenceList': {
        const entityReferences = (value as EntityReference[]) ?? [];

        return (
          <div className="entity-list-body">
            {entityReferences.map((item) => {
              return (
                <div
                  className="entity-reference-list-item flex items-center justify-between"
                  data-testid={getEntityName(item)}
                  key={item.id}>
                  <div className="d-flex items-center">
                    <Link
                      to={entityUtilClassBase.getEntityLink(
                        item.type,
                        item.fullyQualifiedName as string
                      )}>
                      <Button
                        className="entity-button flex-center p-0"
                        icon={
                          <div className="entity-button-icon m-r-xs">
                            {['user', 'team'].includes(item.type) ? (
                              <ProfilePicture
                                className="d-flex"
                                isTeam={item.type === 'team'}
                                name={item.name ?? ''}
                                type="circle"
                                width="20"
                              />
                            ) : (
                              searchClassBase.getEntityIcon(item.type)
                            )}
                          </div>
                        }
                        type="text">
                        <Typography.Text
                          className="text-left text-lg truncate w-68"
                          ellipsis={{ tooltip: true }}>
                          {getEntityName(item)}
                        </Typography.Text>
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      case 'entityReference': {
        const item = value as EntityReference;

        if (isUndefined(item)) {
          return null;
        }

        return (
          <div
            className="d-flex items-center"
            data-testid="entityReference-value">
            <Link
              to={entityUtilClassBase.getEntityLink(
                item.type,
                item.fullyQualifiedName as string
              )}>
              <Button
                className="entity-button flex-center p-0"
                icon={
                  <div
                    className="entity-button-icon m-r-xs"
                    style={{ width: '20px', display: 'flex' }}>
                    {['user', 'team'].includes(item.type) ? (
                      <ProfilePicture
                        className="d-flex"
                        isTeam={item.type === 'team'}
                        name={item.name ?? ''}
                        type="circle"
                        width="20"
                      />
                    ) : (
                      searchClassBase.getEntityIcon(item.type)
                    )}
                  </div>
                }
                type="text">
                <Typography.Text
                  className="text-left text-lg truncate w-68"
                  data-testid="entityReference-value-name"
                  ellipsis={{ tooltip: true }}>
                  {getEntityName(item)}
                </Typography.Text>
              </Button>
            </Link>
          </div>
        );
      }
      case 'timeInterval': {
        const timeInterval = value as TimeIntervalType;

        if (isUndefined(timeInterval)) {
          return null;
        }

        return (
          <Typography.Text
            className="break-all"
            data-testid="time-interval-value">
            <span>
              <Typography.Text className="text-xs">{`StartTime: `}</Typography.Text>
              <Typography.Text className="text-sm font-medium text-grey-body">
                {timeInterval.start}
              </Typography.Text>
              <Divider className="self-center" type="vertical" />
              <Typography.Text className="text-xs">{`EndTime: `}</Typography.Text>
              <Typography.Text className="text-sm font-medium text-grey-body">
                {timeInterval.end}
              </Typography.Text>
            </span>
          </Typography.Text>
        );
      }

      case 'string':
      case 'integer':
      case 'number':
      case 'date-cp':
      case 'dateTime-cp':
      case 'time-cp':
      case 'email':
      case 'timestamp':
      case 'duration':
      default:
        return (
          <Typography.Text
            className="break-all text-lg font-medium text-grey-body"
            data-testid="value">
            {value}
          </Typography.Text>
        );
    }
  };

  const getValueElement = () => {
    const propertyValue = getPropertyValue();

    return !isUndefined(value) ? (
      propertyValue
    ) : (
      <span className="text-grey-muted" data-testid="no-data">
        {t('message.no-data')}
      </span>
    );
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    if (!contentRef.current || !property) {
      return;
    }

    const isMarkdownWithValue = propertyType.name === 'markdown' && value;
    const isOverflowing =
      (contentRef.current.scrollHeight > 30 || isMarkdownWithValue) &&
      propertyType.name !== 'entityReference';

    setIsOverflowing(isOverflowing);
  }, [property, extension, contentRef, value]);

  const customPropertyInlineElement = (
    <div className="d-flex flex-column gap-2" data-testid={propertyName}>
      <div className="d-flex justify-between w-full">
        <div className="d-flex flex-column gap-1 w-full">
          <Typography.Text
            className="text-md text-grey-body"
            data-testid="property-name">
            {getEntityName(property)}
          </Typography.Text>
        </div>

        <div className="d-flex gap-2 w-full items-center justify-end">
          {showInput ? getPropertyInput() : getValueElement()}
          {hasEditPermissions && !showInput && (
            <Tooltip
              placement="left"
              title={t('label.edit-entity', { entity: propertyName })}>
              <Icon
                component={EditIconComponent}
                data-testid={`edit-icon${
                  isRenderedInRightPanel ? '-right-panel' : ''
                }`}
                style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                onClick={onShowInput}
              />
            </Tooltip>
          )}
        </div>
      </div>
      <RichTextEditorPreviewer
        className="text-grey-muted"
        markdown={property.description || ''}
        maxLength={70}
      />
    </div>
  );

  const customPropertyElement = (
    <Row data-testid={propertyName} gutter={[0, 16]}>
      <Col span={24}>
        <Row gutter={[0, 2]}>
          <Col className="d-flex justify-between w-full" span={24}>
            <Typography.Text
              className="text-md text-grey-body"
              data-testid="property-name">
              {getEntityName(property)}
            </Typography.Text>
            {hasEditPermissions && !showInput && (
              <Tooltip
                placement="left"
                title={t('label.edit-entity', { entity: propertyName })}>
                <Icon
                  component={EditIconComponent}
                  data-testid={`edit-icon${
                    isRenderedInRightPanel ? '-right-panel' : ''
                  }`}
                  style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                  onClick={onShowInput}
                />
              </Tooltip>
            )}
          </Col>
          <Col span={24}>
            <RichTextEditorPreviewer
              className="text-grey-muted"
              markdown={property.description || ''}
              maxLength={70}
            />
          </Col>
        </Row>
      </Col>

      <Col span={24}>
        <div className="d-flex justify-between w-full gap-2">
          <div
            className="w-full"
            ref={contentRef}
            style={{
              height: isExpanded || showInput ? 'auto' : '30px',
              overflow: isExpanded || showInput ? 'visible' : 'hidden',
            }}>
            {showInput ? getPropertyInput() : getValueElement()}
          </div>
          {isOverflowing && !showInput && (
            <Button
              className="custom-property-value-toggle-btn"
              data-testid={`toggle-${propertyName}`}
              size="small"
              type="text"
              onClick={toggleExpand}>
              {isExpanded ? <UpOutlined /> : <DownOutlined />}
            </Button>
          )}
        </div>
      </Col>
    </Row>
  );

  if (isRenderedInRightPanel) {
    return (
      <div
        className="custom-property-card-right-panel"
        data-testid="custom-property-right-panel-card">
        {isInlineProperty ? customPropertyInlineElement : customPropertyElement}
      </div>
    );
  }

  return (
    <Card
      className="w-full custom-property-card"
      data-testid={`custom-property-${propertyName}-card`}>
      {customPropertyElement}
    </Card>
  );
};
