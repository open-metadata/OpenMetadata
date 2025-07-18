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
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  isArray,
  isEmpty,
  isNil,
  isUndefined,
  noop,
  omitBy,
  toNumber,
} from 'lodash';
import { DateTime } from 'luxon';
import moment, { Moment } from 'moment';
import { CSSProperties, FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ArrowIconComponent } from '../../../assets/svg/drop-down.svg';
import { ReactComponent as EditIconComponent } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as EndTimeArrowIcon } from '../../../assets/svg/end-time-arrow.svg';
import { ReactComponent as EndTimeIcon } from '../../../assets/svg/end-time.svg';
import { ReactComponent as StartTimeIcon } from '../../../assets/svg/start-time.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  VALIDATION_MESSAGES,
} from '../../../constants/constants';
import { TABLE_TYPE_CUSTOM_PROPERTY } from '../../../constants/CustomProperty.constants';
import { TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX } from '../../../constants/regex.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { Config } from '../../../generated/type/customProperty';
import { getCustomPropertyMomentFormat } from '../../../utils/CustomProperty.utils';
import { calculateInterval } from '../../../utils/date-time/DateTimeUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import DataAssetAsyncSelectList from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import DatePicker from '../DatePicker/DatePicker';
import InlineEdit from '../InlineEdit/InlineEdit.component';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';

import {
  PropertyValueProps,
  PropertyValueType,
  TimeIntervalType,
} from './CustomPropertyTable.interface';
import './property-value.less';
import { PropertyInput } from './PropertyInput';
import EditTableTypePropertyModal from './TableTypeProperty/EditTableTypePropertyModal';
import TableTypePropertyView from './TableTypeProperty/TableTypePropertyView';

export const PropertyValue: FC<PropertyValueProps> = ({
  isVersionView,
  versionDataKeys,
  extension,
  onExtensionUpdate,
  hasEditPermissions,
  property,
  isRenderedInRightPanel = false,
}) => {
  const { propertyName, propertyType, value, isTableType } = useMemo(() => {
    const propertyName = property.name;
    const propertyType = property.propertyType;
    const isTableType = propertyType.name === TABLE_TYPE_CUSTOM_PROPERTY;

    const value = extension?.[propertyName];

    return {
      propertyName,
      propertyType,
      value,
      isTableType,
    };
  }, [property, extension]);

  const { t } = useTranslation();
  const [showInput, setShowInput] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // expand the property value by default if it is a "table-type" custom property
  const [isExpanded, setIsExpanded] = useState(isTableType);
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

    const isArrayType = isArray(updatedValue);

    const enumValue = isArrayType ? updatedValue : [updatedValue];

    const propertyValue = isEnum
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
      width: '100%',
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
          entityName: getEntityName(property),
        });

        return (
          <ModalWithMarkdownEditor
            header={header}
            placeholder={t('label.enter-property-value')}
            value={value ?? ''}
            visible={showInput}
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
        const format = getCustomPropertyMomentFormat(
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
        const format = getCustomPropertyMomentFormat(
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
                  searchIndex={index.join(',') as SearchIndex}
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
            {showInput && (
              <TableTypePropertyView columns={columns} rows={rows} />
            )}
            <EditTableTypePropertyModal
              columns={columns}
              isUpdating={isLoading}
              isVisible={showInput}
              property={property}
              rows={value?.rows ?? []}
              onCancel={onHideInput}
              onSave={onInputSave}
            />
          </>
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
        <RichTextEditorPreviewerV1
          className={isKeyAdded ? 'diff-added' : ''}
          markdown={String(value) || ''}
        />
      );
    }
    switch (propertyType.name) {
      case 'markdown':
        return <RichTextEditorPreviewerV1 markdown={value ?? ''} />;

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
                                width="18"
                              />
                            ) : (
                              searchClassBase.getEntityIcon(item.type)
                            )}
                          </div>
                        }
                        type="text">
                        <Typography.Text
                          className="text-left text-primary truncate w-68"
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
                        width="18"
                      />
                    ) : (
                      searchClassBase.getEntityIcon(item.type)
                    )}
                  </div>
                }
                type="text">
                <Typography.Text
                  className="text-left text-primary truncate w-68 "
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
          <div
            className="d-flex justify-center flex-wrap gap-2 py-2"
            data-testid="time-interval-value">
            <div className="d-flex flex-column gap-2 items-center">
              <StartTimeIcon height={30} width={30} />
              <Typography.Text className="property-value">{`${t(
                'label.start-entity',
                {
                  entity: t('label.time'),
                }
              )}`}</Typography.Text>
              <Typography.Text className="text-sm text-grey-body property-value">
                {timeInterval.start}
              </Typography.Text>
            </div>
            <div className="d-flex items-center">
              <EndTimeArrowIcon />
              <Tag className="time-interval-separator">
                {calculateInterval(timeInterval.start, timeInterval.end)}
              </Tag>
              <EndTimeArrowIcon />
            </div>
            <div className="d-flex flex-column gap-2 items-center">
              <EndTimeIcon height={30} width={30} />
              <Typography.Text className="property-value">{`${t(
                'label.end-entity',
                {
                  entity: t('label.time'),
                }
              )}`}</Typography.Text>
              <Typography.Text className="text-sm text-grey-body property-value">
                {timeInterval.end}
              </Typography.Text>
            </div>
          </div>
        );
      }

      case TABLE_TYPE_CUSTOM_PROPERTY: {
        const columns =
          (property.customPropertyConfig?.config as Config)?.columns ?? [];
        const rows = value?.rows ?? [];

        return <TableTypePropertyView columns={columns} rows={rows} />;
      }

      case 'string':
      case 'integer':
      case 'number':
      case 'date-cp':
      case 'time-cp':
      case 'email':
      case 'timestamp':
      case 'duration':
      case 'dateTime-cp':
      default:
        return (
          <Typography.Text
            className="break-all text-grey-body property-value"
            data-testid="value">
            {value}
          </Typography.Text>
        );
    }
  };

  const getValueElement = () => {
    const propertyValue = getPropertyValue();

    // if value is not undefined or property is a table type(at least show the columns), return the property value
    return !isUndefined(value) || isTableType ? (
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
      propertyType.name !== 'entityReference' &&
      !isRenderedInRightPanel;

    setIsOverflowing(isOverflowing);
  }, [property, extension, contentRef, value]);

  const containerStyleFlag = useMemo(() => {
    return isExpanded || showInput || isRenderedInRightPanel;
  }, [isExpanded, showInput, isRenderedInRightPanel]);

  const customPropertyElement = (
    <Row data-testid={propertyName} gutter={[0, 8]}>
      <Col span={24}>
        <Row gutter={[0, 2]}>
          <Col className="d-flex justify-between items-center w-full" span={24}>
            <Typography.Text
              className="text-grey-body property-name"
              data-testid="property-name">
              {getEntityName(property)}
            </Typography.Text>
            {hasEditPermissions && !showInput && (
              <Tooltip
                placement="left"
                title={t('label.edit-entity', {
                  entity: getEntityName(property),
                })}>
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
        </Row>
      </Col>

      <Col span={24}>
        <div
          className={classNames(
            'd-flex justify-between w-full gap-2',
            {
              'items-end': isExpanded,
            },
            {
              'items-center': !isExpanded,
            }
          )}>
          <div
            className="w-full"
            ref={contentRef}
            style={{
              height: containerStyleFlag ? 'auto' : '30px',
              overflow: 'hidden',
            }}>
            {showInput ? getPropertyInput() : getValueElement()}
          </div>
          {isOverflowing && !showInput && (
            <Icon
              className={classNames('custom-property-value-toggle-btn', {
                active: isExpanded,
              })}
              component={ArrowIconComponent}
              data-testid={`toggle-${propertyName}`}
              style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
              onClick={toggleExpand}
            />
          )}
        </div>
      </Col>
    </Row>
  );

  if (isRenderedInRightPanel) {
    return (
      <div
        className="custom-property-card custom-property-card-right-panel"
        data-testid="custom-property-right-panel-card">
        {customPropertyElement}
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
