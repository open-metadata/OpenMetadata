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

import Icon, { InfoCircleOutlined } from '@ant-design/icons';
import { CalendarDate } from '@internationalized/date';
import {
  Badge,
  Card,
  DatePicker,
  Form,
  Input,
  TagSelect,
  TimePicker,
  TimePickerValue,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  isArray,
  isEmpty,
  isNil,
  isUndefined,
  noop,
  omit,
  omitBy,
  toNumber,
} from 'lodash';
import { DateTime } from 'luxon';
import {
  ComponentProps,
  FC,
  lazy,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ArrowIconComponent } from '../../../assets/svg/drop-down.svg';
import { ReactComponent as EditIconComponent } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as EndTimeArrowIcon } from '../../../assets/svg/end-time-arrow.svg';
import { ReactComponent as EndTimeIcon } from '../../../assets/svg/end-time.svg';
import { ReactComponent as StartTimeIcon } from '../../../assets/svg/start-time.svg';
import {
  DE_ACTIVE_COLOR,
  GRAYED_OUT_COLOR,
  ICON_DIMENSION,
} from '../../../constants/constants';
import {
  AUTO_HEIGHT_TYPES,
  HYPERLINK_TYPE_CUSTOM_PROPERTY,
  NO_OVERFLOW_TOGGLE_TYPES,
  SCROLLABLE_WRAPPER_TYPES,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../constants/CustomProperty.constants';
import {
  EMAIL_REG_EX,
  TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX,
} from '../../../constants/regex.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { Hyperlink } from '../../../generated/type/customProperties/complexTypes';
import { Config } from '../../../generated/type/customProperty';
import { getTextFromHtmlString } from '../../../utils/BlockEditorPureUtils';
import {
  formatCustomPropertyDateTime,
  getHyperlinkUrlValidationErrorKey,
  parseCustomPropertyDateTime,
} from '../../../utils/CustomProperty.utils';
import { calculateInterval } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import searchClassBase from '../../../utils/SearchClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import DataAssetAsyncSelectList from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import InlineEdit from '../InlineEdit/InlineEdit.component';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import {
  PropertyValueProps,
  PropertyValueType,
  TableTypePropertyValueType,
  TimeIntervalType,
} from './CustomPropertyTable.interface';
import './property-value.less';
import { PropertyInput } from './PropertyInput';
import TableTypePropertyView from './TableTypeProperty/TableTypePropertyView';

const DATE_CP_TYPE = 'date-cp';
const DATE_TIME_CP_TYPE = 'dateTime-cp';
const TIME_CP_TYPE = 'time-cp';

// core-components bundles its own @internationalized/date, so the app's
// CalendarDate class is nominally different from the DatePicker's DateValue.
type DatePickerValue = ComponentProps<typeof DatePicker>['value'];
const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/SchemaEditor'))
);

const ModalWithMarkdownEditor = withSuspenseFallback(
  lazy(() =>
    import('../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor').then(
      (m) => ({ default: m.ModalWithMarkdownEditor })
    )
  )
);

const EditTableTypePropertyModal = withSuspenseFallback(
  lazy(() => import('./TableTypeProperty/EditTableTypePropertyModal'))
);

// Pure helper (module scope): the property-name suffix showing an item count for
// list-shaped custom property types (entity reference lists, table rows).
function getPropertyCountSuffix(
  propertyTypeName: string | undefined,
  value: PropertyValueType
): string | null {
  if (propertyTypeName === 'entityReferenceList' && isArray(value)) {
    return ` (${value.length})`;
  }

  if (
    propertyTypeName === TABLE_TYPE_CUSTOM_PROPERTY &&
    isArray((value as TableTypePropertyValueType)?.rows)
  ) {
    return ` (${(value as TableTypePropertyValueType).rows.length})`;
  }

  return null;
}

// Pure JSX helper (module scope): the right-panel view uses a plain wrapper div,
// the default view wraps the same content in a Card.
function renderCustomPropertyContainer(
  isRenderedInRightPanel: boolean,
  propertyName: string,
  content: JSX.Element
): JSX.Element {
  if (isRenderedInRightPanel) {
    return (
      <div
        className="custom-property-card custom-property-card-right-panel"
        data-testid="custom-property-right-panel-card">
        {content}
      </div>
    );
  }

  return (
    <Card
      className="w-full custom-property-card"
      data-testid={`custom-property-${propertyName}-card`}>
      <Card.Content className="tw:overflow-x-auto tw:scrollbar-hide">
        {content}
      </Card.Content>
    </Card>
  );
}

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Editor drafts: `undefined` means untouched, so the editor falls back to the saved value.
  const [enumDraft, setEnumDraft] = useState<string[]>();
  const [dateTimeDraft, setDateTimeDraft] = useState<DateTime | null>();
  const [entityReferenceDraft, setEntityReferenceDraft] = useState<{
    value?: DataAssetOption | DataAssetOption[];
  }>();
  const sqlDraftRef = useRef<string>();

  // expand the property value by default if it is a "table-type" custom property
  const [isExpanded, setIsExpanded] = useState(isTableType);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const onShowInput = () => {
    setErrors({});
    setEnumDraft(undefined);
    setDateTimeDraft(undefined);
    setEntityReferenceDraft(undefined);
    sqlDraftRef.current = undefined;
    setShowInput(true);
  };

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

  const resolveEntityReferences = (
    entityReference: DataAssetOption | DataAssetOption[],
    options: DataAssetOption[]
  ): EntityReference | EntityReference[] => {
    if (Array.isArray(entityReference)) {
      return entityReference
        .map((item) => findOptionReference(item, options))
        .filter(Boolean) as EntityReference[];
    }

    return findOptionReference(entityReference, options) as EntityReference;
  };

  const onInputSave = async (updatedValue?: PropertyValueType) => {
    const isEnum = propertyType.name === 'enum';

    const isArrayType = isArray(updatedValue);

    const enumValue = isArrayType ? updatedValue : [updatedValue];

    const propertyValue = isEnum
      ? (enumValue as string[]).filter(Boolean)
      : updatedValue;

    try {
      const isNumericType = ['integer', 'number'].includes(
        propertyType.name ?? ''
      );
      const numericValue = updatedValue ? toNumber(updatedValue) : updatedValue;
      const resolvedValue = isNumericType ? numericValue : propertyValue;

      // Omit undefined and empty values
      const updatedExtension = omitBy(
        omitBy(
          {
            ...extension,
            [propertyName]: resolvedValue,
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
    const typeName = propertyType.name ?? '';
    const config = property.customPropertyConfig?.config;

    const readField = (data: FormData, name: string) =>
      (data.get(name) as string | null) || undefined;

    const getTimestampError = (timestamp?: string) =>
      timestamp && !TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX.test(timestamp)
        ? t('message.invalid-unix-epoch-time-milliseconds')
        : undefined;

    // Surfaces field errors; returns true when the form must not be saved.
    const hasFieldErrors = (
      fieldErrors: Record<string, string | undefined>
    ) => {
      const invalidFields = omitBy(fieldErrors, isUndefined) as Record<
        string,
        string
      >;
      setErrors(invalidFields);

      return !isEmpty(invalidFields);
    };

    // The native form keeps Enter-to-submit; InlineEdit's save button submits it via `form`.
    const renderInlineForm = (
      formId: string,
      onSubmit: (data: FormData) => void,
      children: ReactNode
    ) => (
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
          className="tw:flex tw:flex-col tw:gap-4"
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(new FormData(e.currentTarget));
          }}>
          {children}
        </Form>
      </InlineEdit>
    );

    const renderTextField = (
      name: string,
      dataTestId: string,
      placeholder: string,
      defaultValue?: string
    ) => (
      <Input
        defaultValue={defaultValue}
        hint={
          errors[name] && (
            <span data-testid={`${dataTestId}-error`}>{errors[name]}</span>
          )
        }
        inputDataTestId={dataTestId}
        isDisabled={isLoading}
        isInvalid={Boolean(errors[name])}
        name={name}
        placeholder={placeholder}
        onChange={() => setErrors(omit(errors, name))}
      />
    );

    const renderTextInput = () => {
      const inputType = ['integer', 'number'].includes(typeName)
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
    };

    const renderMarkdownInput = () => {
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
    };

    const renderEnumInput = () => {
      const enumConfig = config as Config;
      const isMultiSelect = Boolean(enumConfig?.multiSelect);
      const options = (enumConfig?.values ?? []).map((option) => ({
        id: option,
        label: option,
      }));
      const selectedValues =
        enumDraft ?? (isArray(value) ? value : [value]).filter(Boolean);

      return renderInlineForm(
        `enum-form-${propertyName}`,
        () => onInputSave(selectedValues),
        <TagSelect
          allowClear
          data-testid="enum-select"
          isDisabled={isLoading}
          options={options}
          placeholder={t('label.enum-value-plural')}
          value={selectedValues}
          // ponytail: single-select reuses TagSelect (keeps allowClear) by keeping only the latest pick
          onChange={(ids) => setEnumDraft(isMultiSelect ? ids : ids.slice(-1))}
        />
      );
    };

    const renderDateTimeInput = () => {
      const initialValue = value
        ? parseCustomPropertyDateTime(value, typeName, config)
        : undefined;
      const dateTime = isUndefined(dateTimeDraft)
        ? (initialValue?.isValid && initialValue) || null
        : dateTimeDraft;
      const baseDateTime = dateTime ?? DateTime.now().startOf('day');
      const showDate = typeName !== TIME_CP_TYPE;
      const showTime = typeName !== DATE_CP_TYPE;

      const handleDateChange = (date: DatePickerValue) =>
        setDateTimeDraft(
          date
            ? baseDateTime.set({
                year: date.year,
                month: date.month,
                day: date.day,
              })
            : null
        );

      const handleTimeChange = (time: TimePickerValue | null) => {
        if (time) {
          setDateTimeDraft(
            baseDateTime.set({
              hour: time.hour,
              minute: time.minute,
              second: time.second ?? 0,
            })
          );
        } else {
          setDateTimeDraft(showDate ? dateTime?.startOf('day') ?? null : null);
        }
      };

      return renderInlineForm(
        `dateTime-form-${propertyName}`,
        () =>
          onInputSave(
            dateTime
              ? formatCustomPropertyDateTime(dateTime, typeName, config)
              : undefined
          ),
        <div className="tw:flex tw:gap-2">
          {showDate && (
            <DatePicker
              aria-label={t('label.date')}
              data-testid="date-time-picker"
              isDisabled={isLoading}
              value={
                (dateTime
                  ? new CalendarDate(
                      dateTime.year,
                      dateTime.month,
                      dateTime.day
                    )
                  : null) as DatePickerValue
              }
              onChange={handleDateChange}
            />
          )}
          {showTime && (
            <TimePicker
              aria-label={t('label.time')}
              data-testid="time-picker"
              granularity="second"
              hourCycle={24}
              isDisabled={isLoading}
              value={dateTime}
              onChange={handleTimeChange}
            />
          )}
        </div>
      );
    };

    const renderEmailInput = () =>
      renderInlineForm(
        `email-form-${propertyName}`,
        (data) => {
          const email = readField(data, 'email');
          const label = t('label.email');
          let emailError: string | undefined;

          if (email && !EMAIL_REG_EX.test(email)) {
            emailError = t('message.entity-is-not-valid', { entity: label });
          } else if (email && (email.length < 6 || email.length > 127)) {
            emailError = t('message.entity-size-in-between', {
              entity: label,
              min: 6,
              max: 127,
            });
          }

          if (!hasFieldErrors({ email: emailError })) {
            onInputSave(email);
          }
        },
        renderTextField('email', 'email-input', 'john@doe.com', value)
      );

    const renderTimestampInput = () =>
      renderInlineForm(
        `timestamp-form-${propertyName}`,
        (data) => {
          const timestamp = readField(data, 'timestamp');

          if (!hasFieldErrors({ timestamp: getTimestampError(timestamp) })) {
            onInputSave(timestamp ? toNumber(timestamp) : undefined);
          }
        },
        renderTextField(
          'timestamp',
          'timestamp-input',
          t('message.unix-epoch-time-in-ms', { prefix: '' }),
          value?.toString()
        )
      );

    const renderTimeIntervalInput = () =>
      renderInlineForm(
        `timeInterval-form-${propertyName}`,
        (data) => {
          const start = readField(data, 'start');
          const end = readField(data, 'end');

          if (
            hasFieldErrors({
              start: getTimestampError(start),
              end: getTimestampError(end),
            })
          ) {
            return;
          }

          onInputSave(
            omitBy(
              {
                start: start ? toNumber(start) : undefined,
                end: end ? toNumber(end) : undefined,
              },
              isUndefined
            ) as TimeIntervalType
          );
        },
        <>
          {renderTextField(
            'start',
            'start-input',
            t('message.unix-epoch-time-in-ms', { prefix: 'Start' }),
            value?.start?.toString()
          )}
          {renderTextField(
            'end',
            'end-input',
            t('message.unix-epoch-time-in-ms', { prefix: 'End' }),
            value?.end?.toString()
          )}
        </>
      );

    const renderDurationInput = () =>
      renderInlineForm(
        `duration-form-${propertyName}`,
        (data) => onInputSave(readField(data, 'duration')),
        renderTextField(
          'duration',
          'duration-input',
          t('message.duration-in-iso-format'),
          value
        )
      );

    const renderSqlQueryInput = () =>
      renderInlineForm(
        `sqlQuery-form-${propertyName}`,
        () => onInputSave(sqlDraftRef.current ?? value),
        <SchemaEditor
          className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
          mode={{ name: CSMode.SQL }}
          showCopyButton={false}
          value={value}
          onChange={(query) => (sqlDraftRef.current = query)}
        />
      );

    const renderEntityReferenceInput = () => {
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

      const selectedValue = entityReferenceDraft
        ? entityReferenceDraft.value
        : initialValue;

      return renderInlineForm(
        `entity-reference-form-${propertyName}`,
        () =>
          onInputSave(
            resolveEntityReferences(
              selectedValue as DataAssetOption | DataAssetOption[],
              initialOptions
            )
          ),
        <DataAssetAsyncSelectList
          id="entityReference"
          initialOptions={initialOptions}
          mode={mode}
          placeholder={
            mode === 'multiple'
              ? t('label.entity-reference')
              : t('label.entity-reference-plural')
          }
          searchIndex={index.join(',') as SearchIndex}
          value={selectedValue}
          onChange={(option) => setEntityReferenceDraft({ value: option })}
        />
      );
    };

    const renderTableTypeInput = () => {
      const config = property.customPropertyConfig?.config as Config;

      const columns = config?.columns ?? [];
      const rows = value?.rows ?? [];

      return (
        <>
          {showInput && <TableTypePropertyView columns={columns} rows={rows} />}
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
    };

    const renderHyperlinkInput = () => {
      const hyperlinkValue = value as Hyperlink | undefined;

      return renderInlineForm(
        `hyperlink-form-${propertyName}`,
        (data) => {
          const url = readField(data, 'url');
          const displayText = readField(data, 'displayText');
          const urlErrorKey = getHyperlinkUrlValidationErrorKey(url);
          let urlError: string | undefined;

          if (!url) {
            urlError = t('label.field-required', {
              field: t('label.url-uppercase'),
            });
          } else if (urlErrorKey) {
            urlError = t(urlErrorKey);
          }

          if (!hasFieldErrors({ url: urlError })) {
            onInputSave({
              url: url ?? '',
              ...(displayText ? { displayText } : {}),
            });
          }
        },
        <>
          {renderTextField(
            'url',
            'hyperlink-url-input',
            t('label.enter-entity', { entity: t('label.url-uppercase') }),
            hyperlinkValue?.url
          )}
          {renderTextField(
            'displayText',
            'hyperlink-display-text-input',
            t('label.enter-entity', { entity: t('label.display-text') }),
            hyperlinkValue?.displayText
          )}
        </>
      );
    };

    const inputRenderers: Record<string, () => JSX.Element | null> = {
      string: renderTextInput,
      integer: renderTextInput,
      number: renderTextInput,
      markdown: renderMarkdownInput,
      enum: renderEnumInput,
      [DATE_CP_TYPE]: renderDateTimeInput,
      [DATE_TIME_CP_TYPE]: renderDateTimeInput,
      [TIME_CP_TYPE]: renderDateTimeInput,
      email: renderEmailInput,
      timestamp: renderTimestampInput,
      timeInterval: renderTimeIntervalInput,
      duration: renderDurationInput,
      sqlQuery: renderSqlQueryInput,
      entityReference: renderEntityReferenceInput,
      entityReferenceList: renderEntityReferenceInput,
      [TABLE_TYPE_CUSTOM_PROPERTY]: renderTableTypeInput,
      [HYPERLINK_TYPE_CUSTOM_PROPERTY]: renderHyperlinkInput,
    };

    const renderer = inputRenderers[typeName];

    return renderer ? renderer() : null;
  };

  const getEntityRefLinkValue = (item: EntityReference) => (
    <Link
      className="entity-ref-link"
      to={entityUtilClassBase.getEntityLink(
        item.type,
        item.fullyQualifiedName ?? item.name ?? ''
      )}>
      <div className="entity-icon m-r-xs">
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
      <Typography ellipsis={{ tooltip: true }}>
        {getEntityName(item)}
      </Typography>
    </Link>
  );

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

    const renderMarkdownValue = () => (
      <RichTextEditorPreviewerV1 markdown={value ?? ''} />
    );

    const renderEnumValue = () => (
      <>
        {isArray(value) ? (
          <div
            className="w-max-full d-flex gap-2 flex-wrap"
            data-testid="enum-value">
            {value.map((val) => (
              <Tooltip
                excludeTriggerFromTabOrder
                key={val}
                title={val}
                triggerClassName="tw:inline-flex">
                <Badge size="sm">{val}</Badge>
              </Tooltip>
            ))}
          </div>
        ) : (
          <Tooltip
            excludeTriggerFromTabOrder
            key={value}
            title={value}
            triggerClassName="tw:inline-flex">
            <Badge data-testid="enum-value" size="sm">
              {value}
            </Badge>
          </Tooltip>
        )}
      </>
    );

    const renderSqlQueryValue = () => (
      <SchemaEditor
        className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
        mode={{ name: CSMode.SQL }}
        options={{
          readOnly: true,
        }}
        value={value ?? ''}
      />
    );

    const renderEntityReferenceListValue = () => {
      const entityReferences = (value as EntityReference[]) ?? [];

      return (
        <div className="entity-list-body">
          {entityReferences.map((item) => {
            return (
              <div
                className="entity-reference-list-item flex items-center justify-between"
                data-testid={getEntityName(item)}
                key={item.id}>
                {getEntityRefLinkValue(item)}
              </div>
            );
          })}
        </div>
      );
    };

    const renderEntityReferenceValue = () => {
      const item = value as EntityReference;

      if (isUndefined(item)) {
        return null;
      }

      return (
        <div className="entity-list-body" data-testid="entityReference-value">
          {getEntityRefLinkValue(item)}
        </div>
      );
    };

    const renderTimeIntervalValue = () => {
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
            <Typography className="property-value" weight="medium">{`${t(
              'label.start-entity',
              {
                entity: t('label.time'),
              }
            )}`}</Typography>
            <Typography
              className="property-value"
              size="text-sm"
              weight="medium">
              {timeInterval.start}
            </Typography>
          </div>
          <div className="d-flex items-center">
            <EndTimeArrowIcon />
            <Badge size="sm">
              {calculateInterval(timeInterval.start, timeInterval.end)}
            </Badge>
            <EndTimeArrowIcon />
          </div>
          <div className="d-flex flex-column gap-2 items-center">
            <EndTimeIcon height={30} width={30} />
            <Typography className="property-value" weight="medium">{`${t(
              'label.end-entity',
              {
                entity: t('label.time'),
              }
            )}`}</Typography>
            <Typography
              className="property-value"
              size="text-sm"
              weight="medium">
              {timeInterval.end}
            </Typography>
          </div>
        </div>
      );
    };

    const renderTableTypeValue = () => {
      const columns =
        (property.customPropertyConfig?.config as Config)?.columns ?? [];
      const rows = value?.rows ?? [];

      return <TableTypePropertyView columns={columns} rows={rows} />;
    };

    const renderHyperlinkValue = () => {
      const hyperlinkValue = value as Hyperlink | undefined;

      if (!hyperlinkValue?.url) {
        return null;
      }

      const isSafeUrl = (url: string): boolean => {
        try {
          const parsed = new URL(url);

          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      };

      const safeHref = isSafeUrl(hyperlinkValue.url) ? hyperlinkValue.url : '#';

      return (
        <Typography
          as="a"
          className="break-all property-value not-prose"
          data-testid="hyperlink-value"
          href={safeHref}
          rel="noopener noreferrer"
          target="_blank"
          weight="medium">
          {hyperlinkValue.displayText || hyperlinkValue.url}
        </Typography>
      );
    };

    const renderDefaultValue = () => (
      <Typography
        className="break-all property-value"
        data-testid="value"
        weight="medium">
        {value}
      </Typography>
    );

    const valueRenderers: Record<string, () => JSX.Element | null> = {
      markdown: renderMarkdownValue,
      enum: renderEnumValue,
      sqlQuery: renderSqlQueryValue,
      entityReferenceList: renderEntityReferenceListValue,
      entityReference: renderEntityReferenceValue,
      timeInterval: renderTimeIntervalValue,
      [TABLE_TYPE_CUSTOM_PROPERTY]: renderTableTypeValue,
      [HYPERLINK_TYPE_CUSTOM_PROPERTY]: renderHyperlinkValue,
    };

    const renderer =
      valueRenderers[propertyType.name ?? ''] ?? renderDefaultValue;

    return renderer();
  };

  const getValueElement = () => {
    const propertyValue = getPropertyValue();
    const isScrollableType = SCROLLABLE_WRAPPER_TYPES.includes(
      propertyType.name || ''
    );

    if (!isUndefined(value) || isTableType) {
      if (isScrollableType) {
        return (
          <div className="custom-property-scrollable-container w-full">
            {propertyValue}
          </div>
        );
      }

      return propertyValue;
    }

    return (
      <Typography color="secondary" data-testid="no-data">
        {t('label.not-set')}
      </Typography>
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
      (contentRef.current.scrollHeight > 32 || isMarkdownWithValue) &&
      !NO_OVERFLOW_TOGGLE_TYPES.includes(propertyType.name || '') &&
      !isRenderedInRightPanel;

    setIsOverflowing(isOverflowing);
  }, [property, extension, contentRef, value]);

  const containerStyleFlag = useMemo(() => {
    return isExpanded || showInput || isRenderedInRightPanel;
  }, [isExpanded, showInput, isRenderedInRightPanel]);

  const propertyCountSuffix = getPropertyCountSuffix(propertyType.name, value);

  const renderActionIcons = () => (
    <div className="d-flex items-center gap-1 flex-shrink-0">
      {hasEditPermissions && (
        <Tooltip
          placement="left"
          title={t('label.edit-entity', {
            entity: getEntityName(property),
          })}
          triggerClassName="tw:flex"
          onTriggerPress={onShowInput}>
          <Icon
            component={EditIconComponent}
            data-testid={`edit-icon${
              isRenderedInRightPanel ? '-right-panel' : ''
            }`}
            style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
          />
        </Tooltip>
      )}
      {isOverflowing && (
        <Icon
          className={classNames('custom-property-value-toggle-btn', {
            active: isExpanded,
          })}
          component={ArrowIconComponent}
          data-testid={`toggle-${propertyName}`}
          style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
          tabIndex={0}
          onClick={toggleExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              toggleExpand();
            }
          }}
        />
      )}
    </div>
  );

  const customPropertyElement = (
    <div className="tw:flex tw:flex-col tw:gap-2" data-testid={propertyName}>
      <div className="d-flex items-center gap-1">
        <Typography className="property-name" data-testid="property-name">
          {getEntityName(property)}
          {propertyCountSuffix}
        </Typography>
        {property.description && (
          <Tooltip
            placement="top"
            title={getTextFromHtmlString(property.description)}
            triggerClassName="tw:flex">
            <InfoCircleOutlined
              className="custom-property-description-icon"
              data-testid="custom-property-description-icon"
              style={{ color: GRAYED_OUT_COLOR, fontSize: '14px' }}
            />
          </Tooltip>
        )}
      </div>

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
          className="value-container"
          data-testid="property-value"
          ref={contentRef}
          style={{
            height:
              containerStyleFlag ||
              AUTO_HEIGHT_TYPES.includes(propertyType.name || '')
                ? 'auto'
                : '32px',
          }}>
          {showInput ? getPropertyInput() : getValueElement()}
        </div>
        {!showInput &&
          (hasEditPermissions || isOverflowing) &&
          renderActionIcons()}
      </div>
    </div>
  );

  return renderCustomPropertyContainer(
    isRenderedInRightPanel,
    propertyName,
    customPropertyElement
  );
};
