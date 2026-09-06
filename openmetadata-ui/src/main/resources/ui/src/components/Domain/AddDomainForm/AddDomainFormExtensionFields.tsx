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

import { CalendarDate } from '@internationalized/date';
import {
  Avatar,
  Box,
  Button,
  DatePicker,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  getField,
  HintText,
  Input,
  TimePicker,
  TimePickerValue,
} from '@openmetadata/ui-core-components';
import { Users01 } from '@untitledui/icons';
import { debounce } from 'lodash';
import { DateTime } from 'luxon';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import type { Column } from 'react-data-grid';
import { Control, RegisterOptions } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import {
  EMAIL_REG_EX,
  TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX,
} from '../../../constants/regex.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  CustomProperty,
  EntityReference,
} from '../../../generated/entity/type';
import { IntakeFormField } from '../../../generated/governance/intakeForm';
import { useGridEditController } from '../../../hooks/useGridEditController';
import { searchQuery } from '../../../rest/searchAPI';
import { getRandomColor } from '../../../utils/ColorUtils';
import {
  filterPopulatedTableRows,
  formatCustomPropertyDateTime,
  getCustomPropertyLuxonFormat,
  getCustomPropertyReferenceSearchIndex,
  getHyperlinkUrlValidationErrorKey,
  hasPopulatedTableRows,
} from '../../../utils/CustomProperty.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityReferenceUtils';
import TableTypePropertyEditTable from '../../common/CustomPropertyTable/TableTypeProperty/TableTypePropertyEditTable';
import type { TableTypePropertyEditTableProps } from '../../common/CustomPropertyTable/TableTypeProperty/TableTypePropertyEditTable.interface';
import CustomPropertyTypeBadge from '../../common/CustomPropertyTypeBadge/CustomPropertyTypeBadge.component';
import { lazyTextEditor } from '../../common/DataGrid/LazyDataGrid';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import {
  DomainFormSelectItem,
  DomainFormValues,
} from './AddDomainForm.interface';
import {
  getExtensionFieldKind,
  getExtensionFormKey,
  getExtensionPropertyName,
} from './AddDomainFormExtensionFields.utils';

interface AddDomainFormExtensionFieldsProps {
  control: Control<DomainFormValues>;
  customProperties: CustomProperty[];
  formFields: IntakeFormField[];
}

interface ExtensionFieldProps {
  control: Control<DomainFormValues>;
  dataTestId: string;
  definition: CustomProperty;
  isRequired: boolean;
  label: string;
  labelNode: ReactNode;
  name: `extensionFormValues.${string}`;
  requiredMessage: string;
}

interface ReferenceSearchSource extends Omit<EntityReference, 'type'> {
  entityType?: EntityType;
  profile?: {
    images?: {
      image?: string;
    };
  };
  type?: EntityType;
}

interface TableExtensionValue {
  columns: string[];
  rows: Record<string, string>[];
}

interface DateParts {
  day: number;
  month: number;
  year: number;
}

// core-components bundles its own @internationalized/date, so the app's
// CalendarDate class is nominally different from the DatePicker's DateValue.
type DatePickerValue = ComponentProps<typeof DatePicker>['value'];

const getNumberInputStringValue = (value: unknown): string => {
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }

  return '';
};

const getReferenceIcon = (source: ReferenceSearchSource) => {
  const entityType = source.entityType ?? source.type;
  if (entityType === EntityType.TEAM) {
    return <Avatar placeholderIcon={Users01} size="xs" />;
  }
  if (entityType === EntityType.USER) {
    const { color, backgroundColor, character } = getRandomColor(
      source.displayName ?? source.name ?? ''
    );

    return (
      <Avatar
        initials={character}
        size="xs"
        src={source.profile?.images?.image}
        style={{ color, backgroundColor }}
      />
    );
  }

  return undefined;
};

export const fetchExtensionReferenceOptions = async (
  definition: CustomProperty,
  searchText = ''
): Promise<DomainFormSelectItem[]> => {
  const response = await searchQuery({
    pageNumber: 1,
    pageSize: PAGE_SIZE_MEDIUM,
    query: searchText ? `*${searchText}*` : '*',
    queryFilter: {
      query: { bool: { must_not: [{ match: { isBot: true } }] } },
    },
    searchIndex: getCustomPropertyReferenceSearchIndex(definition),
  });

  return response.hits.hits.flatMap(({ _source }) => {
    const source = _source as ReferenceSearchSource;
    const entityType = source.entityType ?? source.type;
    if (!entityType) {
      return [];
    }
    const reference = getEntityReferenceFromEntity(source, entityType);

    return [
      {
        id: source.id,
        icon: getReferenceIcon(source),
        label: getEntityName(source),
        supportingText: source.fullyQualifiedName,
        value: reference,
      },
    ];
  });
};

const ExtensionFieldContainer = ({
  children,
  error,
  isRequired,
  label,
}: {
  children: ReactNode;
  error?: string;
  isRequired: boolean;
  label: ReactNode;
}) => (
  <Box
    aria-invalid={error ? true : undefined}
    className="tw:gap-1.5"
    direction="col">
    <FormItemLabel label={label} required={isRequired} />
    {children}
    {error && <HintText isInvalid>{error}</HintText>}
  </Box>
);

const NumberExtensionField = ({
  control,
  dataTestId,
  definition,
  isRequired,
  label,
  labelNode,
  name,
  requiredMessage,
  timestamp = false,
}: ExtensionFieldProps & { timestamp?: boolean }) => {
  const { t } = useTranslation();
  const requiresInteger =
    timestamp || definition.propertyType.name === 'integer';
  const invalidNumberMessage = t('label.field-invalid', { field: label });
  const rules: RegisterOptions<DomainFormValues> = {
    required: isRequired ? requiredMessage : false,
    validate: (value) => {
      if (value === undefined || value === '') {
        return true;
      }
      const numericValue = Number(value);
      if (
        !Number.isFinite(numericValue) ||
        (requiresInteger && !Number.isInteger(numericValue))
      ) {
        return invalidNumberMessage;
      }

      return (
        !timestamp ||
        TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX.test(String(value)) ||
        t('message.invalid-unix-epoch-time-milliseconds')
      );
    },
  };

  return (
    <FormField control={control} name={name} rules={rules}>
      {({ field, fieldState }) => (
        <ExtensionFieldContainer
          error={fieldState.error?.message}
          isRequired={isRequired}
          label={labelNode}>
          <Input
            aria-label={label}
            inputDataTestId={dataTestId}
            isInvalid={fieldState.invalid}
            isRequired={isRequired}
            name={field.name}
            step={
              !timestamp && definition.propertyType.name === 'number'
                ? 'any'
                : 1
            }
            type="number"
            value={getNumberInputStringValue(field.value)}
            onBlur={field.onBlur}
            onChange={(value) =>
              field.onChange(value === '' ? undefined : value)
            }
          />
        </ExtensionFieldContainer>
      )}
    </FormField>
  );
};

const HyperlinkExtensionField = ({
  control,
  dataTestId,
  isRequired,
  labelNode,
  name,
  requiredMessage,
}: Omit<ExtensionFieldProps, 'definition'>) => {
  const { t } = useTranslation();
  const urlName = `${name}.url` as `extensionFormValues.${string}`;
  const displayTextName =
    `${name}.displayText` as `extensionFormValues.${string}`;

  return (
    <Box className="tw:gap-3" data-testid={dataTestId} direction="col">
      <FormItemLabel label={labelNode} required={isRequired} />
      <FormField
        control={control}
        name={urlName}
        rules={{
          required: isRequired ? requiredMessage : false,
          validate: (value) => {
            const errorKey = getHyperlinkUrlValidationErrorKey(
              typeof value === 'string' ? value : undefined
            );

            return errorKey ? t(errorKey) : true;
          },
        }}>
        {({ field, fieldState }) => (
          <Input
            hint={
              fieldState.error?.message ??
              t('message.enter-a-valid-link-example')
            }
            inputDataTestId={`${dataTestId}-url`}
            isInvalid={fieldState.invalid}
            isRequired={isRequired}
            label={t('label.url-uppercase')}
            placeholder={t('label.enter-entity', {
              entity: t('label.url-uppercase'),
            })}
            value={typeof field.value === 'string' ? field.value : ''}
            onBlur={field.onBlur}
            onChange={field.onChange}
          />
        )}
      </FormField>
      <FormField control={control} name={displayTextName}>
        {({ field, fieldState }) => (
          <Input
            hint={
              fieldState.error?.message ??
              t('message.enter-text-to-display-for-link')
            }
            inputDataTestId={`${dataTestId}-displayText`}
            isInvalid={fieldState.invalid}
            label={t('label.display-text')}
            placeholder={t('label.enter-entity', {
              entity: t('label.display-text'),
            })}
            value={typeof field.value === 'string' ? field.value : ''}
            onBlur={field.onBlur}
            onChange={field.onChange}
          />
        )}
      </FormField>
    </Box>
  );
};

const MarkdownExtensionField = ({
  control,
  dataTestId,
  isRequired,
  labelNode,
  name,
  requiredMessage,
}: Omit<ExtensionFieldProps, 'definition'>) => {
  return (
    <FormField
      control={control}
      name={name}
      rules={{ required: isRequired ? requiredMessage : false }}>
      {({ field, fieldState }) => (
        <ExtensionFieldContainer
          error={fieldState.error?.message}
          isRequired={isRequired}
          label={labelNode}>
          <Box data-testid={dataTestId} direction="col">
            <RichTextEditor
              className="new-form-style"
              initialValue={typeof field.value === 'string' ? field.value : ''}
              onTextChange={field.onChange}
            />
          </Box>
        </ExtensionFieldContainer>
      )}
    </FormField>
  );
};

const getCalendarDate = (value: unknown, format: string): DateParts | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = DateTime.fromFormat(value, format, { locale: 'en' });

  return parsed.isValid
    ? { day: parsed.day, month: parsed.month, year: parsed.year }
    : null;
};

const getTimeValue = (
  value: unknown,
  format: string
): TimePickerValue | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = DateTime.fromFormat(value, format, { locale: 'en' });

  return parsed.isValid ? { hour: parsed.hour, minute: parsed.minute } : null;
};

const DateTimeExtensionInput = ({
  dataTestId,
  definition,
  format,
  isInvalid,
  label,
  type,
  value,
  onChange,
}: {
  dataTestId: string;
  definition: CustomProperty;
  format: string;
  isInvalid: boolean;
  label: string;
  onChange: (value: string | undefined) => void;
  type: 'date' | 'dateTime' | 'time';
  value: unknown;
}) => {
  const [date, setDate] = useState(() => getCalendarDate(value, format));
  const [time, setTime] = useState(() => getTimeValue(value, format));

  useEffect(() => {
    if (value === undefined || value === null || value === '') {
      setDate(null);
      setTime(null);
    }
  }, [value]);

  const emitValue = useCallback(
    (nextDate: DateParts | null, nextTime: TimePickerValue | null) => {
      if (type === 'time') {
        onChange(
          nextTime
            ? DateTime.fromObject({
                hour: nextTime.hour,
                minute: nextTime.minute,
                second: 0,
              }).toFormat(format)
            : undefined
        );

        return;
      }
      if (!nextDate) {
        onChange(undefined);

        return;
      }
      onChange(
        formatCustomPropertyDateTime(
          DateTime.fromObject({
            year: nextDate.year,
            month: nextDate.month,
            day: nextDate.day,
            hour: type === 'dateTime' ? nextTime?.hour ?? 0 : 0,
            minute: type === 'dateTime' ? nextTime?.minute ?? 0 : 0,
            second: 0,
          }),
          type === 'dateTime' ? 'dateTime-cp' : 'date-cp',
          definition.customPropertyConfig?.config
        )
      );
    },
    [definition.customPropertyConfig?.config, format, onChange, type]
  );

  const handleDateChange = (nextDate: DateParts | null) => {
    setDate(nextDate);
    emitValue(nextDate, time);
  };

  const handleTimeChange = (nextTime: TimePickerValue | null) => {
    setTime(nextTime);
    emitValue(date, nextTime);
  };

  return (
    <Box className="tw:w-full tw:gap-3" data-testid={dataTestId}>
      {type !== 'time' && (
        <DatePicker
          aria-label={label}
          // DatePicker's trigger is an intrinsic-width Button; stretch it to
          // fill its flex cell so the date field matches the other inputs.
          className="tw:flex-1 tw:*:w-full tw:[&_button]:w-full tw:[&_button]:justify-start"
          isInvalid={isInvalid}
          value={
            (date
              ? new CalendarDate(date.year, date.month, date.day)
              : null) as DatePickerValue
          }
          onChange={(nextDate) =>
            handleDateChange(
              nextDate
                ? {
                    day: nextDate.day,
                    month: nextDate.month,
                    year: nextDate.year,
                  }
                : null
            )
          }
        />
      )}
      {type !== 'date' && (
        <Box className="tw:flex-1" direction="col">
          <TimePicker
            aria-label={label}
            isInvalid={isInvalid}
            value={time}
            onChange={handleTimeChange}
          />
        </Box>
      )}
    </Box>
  );
};

const DateTimeExtensionField = ({
  control,
  dataTestId,
  definition,
  isRequired,
  label,
  labelNode,
  name,
  requiredMessage,
  type,
}: ExtensionFieldProps & { type: 'date' | 'dateTime' | 'time' }) => {
  const format = getCustomPropertyLuxonFormat(
    definition.propertyType.name ?? '',
    definition.customPropertyConfig?.config
  );

  return (
    <FormField
      control={control}
      name={name}
      rules={{ required: isRequired ? requiredMessage : false }}>
      {({ field, fieldState }) => (
        <ExtensionFieldContainer
          error={fieldState.error?.message}
          isRequired={isRequired}
          label={labelNode}>
          <DateTimeExtensionInput
            dataTestId={dataTestId}
            definition={definition}
            format={format}
            isInvalid={fieldState.invalid}
            label={label}
            type={type}
            value={field.value}
            onChange={field.onChange}
          />
        </ExtensionFieldContainer>
      )}
    </FormField>
  );
};

const TimeIntervalExtensionField = ({
  control,
  dataTestId,
  isRequired,
  labelNode,
  name,
  requiredMessage,
}: Omit<ExtensionFieldProps, 'definition'>) => {
  const { t } = useTranslation();
  const startName = `${name}.start` as `extensionFormValues.${string}`;
  const endName = `${name}.end` as `extensionFormValues.${string}`;

  return (
    <Box className="tw:gap-3" data-testid={dataTestId} direction="col">
      <FormItemLabel label={labelNode} required={isRequired} />
      {[
        { fieldName: startName, label: t('label.start'), suffix: 'start' },
        { fieldName: endName, label: t('label.end'), suffix: 'end' },
      ].map(({ fieldName, label: inputLabel, suffix }) => (
        <FormField
          control={control}
          key={fieldName}
          name={fieldName}
          rules={{
            required: isRequired ? requiredMessage : false,
            validate: (value) => {
              const isEmptyValue = value === undefined || value === '';
              const isValidInteger =
                Number.isFinite(Number(value)) &&
                Number.isInteger(Number(value));

              return (
                isEmptyValue ||
                isValidInteger ||
                t('label.field-invalid', { field: inputLabel })
              );
            },
          }}>
          {({ field, fieldState }) => (
            <Input
              hint={fieldState.error?.message}
              inputDataTestId={`${dataTestId}-${suffix}`}
              isInvalid={fieldState.invalid}
              isRequired={isRequired}
              label={inputLabel}
              step={1}
              type="number"
              value={getNumberInputStringValue(field.value)}
              onBlur={field.onBlur}
              onChange={(nextValue) =>
                field.onChange(nextValue === '' ? undefined : nextValue)
              }
            />
          )}
        </FormField>
      ))}
    </Box>
  );
};

const SqlQueryExtensionField = ({
  control,
  dataTestId,
  isRequired,
  labelNode,
  name,
  requiredMessage,
}: Omit<ExtensionFieldProps, 'definition'>) => {
  return (
    <FormField
      control={control}
      name={name}
      rules={{ required: isRequired ? requiredMessage : false }}>
      {({ field, fieldState }) => (
        <ExtensionFieldContainer
          error={fieldState.error?.message}
          isRequired={isRequired}
          label={labelNode}>
          <Box data-testid={dataTestId} direction="col">
            <SchemaEditor
              uncontrolled
              autoFormat={false}
              className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
              mode={{ name: CSMode.SQL }}
              showCopyButton={false}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={field.onChange}
            />
          </Box>
        </ExtensionFieldContainer>
      )}
    </FormField>
  );
};

const getTableColumns = (columns: string[]) =>
  columns.map(
    (column): Column<Record<string, string>> => ({
      editable: true,
      key: column,
      minWidth: 180,
      name: column,
      renderEditCell: lazyTextEditor,
      resizable: true,
      sortable: false,
    })
  );

const TableExtensionInput = ({
  columns,
  dataTestId,
  error,
  isRequired,
  labelNode,
  onChange,
  value,
}: {
  columns: string[];
  dataTestId: string;
  error?: string;
  isRequired: boolean;
  labelNode: ReactNode;
  onChange: (value: TableExtensionValue) => void;
  value: unknown;
}) => {
  const { t } = useTranslation();
  const isRowsObject =
    typeof value === 'object' &&
    value !== null &&
    'rows' in value &&
    Array.isArray(value.rows);
  const initialRows = isRowsObject
    ? (value as { rows: Record<string, string>[] }).rows
    : [];
  const [dataSource, setDataSource] = useState<Record<string, string>[]>(() =>
    initialRows.map((row) => ({ ...row }))
  );
  const gridColumns = useMemo(() => getTableColumns(columns), [columns]);
  const {
    handleAddRow,
    handleCopy,
    handleOnRowsChange,
    handlePaste: untypedHandlePaste,
    setGridContainer,
  } = useGridEditController({
    columns: gridColumns,
    dataSource,
    rowIdKey: null,
    setDataSource,
  });
  const handlePaste =
    untypedHandlePaste as unknown as TableTypePropertyEditTableProps['handlePaste'];

  useEffect(() => {
    onChange({
      columns,
      rows: filterPopulatedTableRows(dataSource),
    });
  }, [columns, dataSource, onChange]);

  return (
    <Box
      aria-invalid={error ? true : undefined}
      className="tw:gap-1.5 tw:[&_.rdg]:h-64!"
      data-testid={dataTestId}
      direction="col">
      <Box align="center" justify="between">
        <FormItemLabel label={labelNode} required={isRequired} />
        <Button color="secondary" size="sm" onPress={handleAddRow}>
          {t('label.add-entity', { entity: t('label.row') })}
        </Button>
      </Box>
      <TableTypePropertyEditTable
        columns={gridColumns}
        dataSource={dataSource}
        handleCopy={handleCopy}
        handleOnRowsChange={handleOnRowsChange}
        handlePaste={handlePaste}
        setGridContainer={setGridContainer}
      />
      {error && <HintText isInvalid>{error}</HintText>}
    </Box>
  );
};

const TableExtensionField = ({
  control,
  dataTestId,
  definition,
  isRequired,
  labelNode,
  name,
  requiredMessage,
}: ExtensionFieldProps) => {
  const config = definition.customPropertyConfig?.config;
  const columns =
    typeof config === 'object' && !Array.isArray(config)
      ? config.columns ?? []
      : [];

  return (
    <FormField
      control={control}
      name={name}
      rules={{
        validate: (value) =>
          hasPopulatedTableRows(value) || !isRequired || requiredMessage,
      }}>
      {({ field, fieldState }) => (
        <TableExtensionInput
          columns={columns}
          dataTestId={dataTestId}
          error={fieldState.error?.message}
          isRequired={isRequired}
          labelNode={labelNode}
          value={field.value}
          onChange={field.onChange}
        />
      )}
    </FormField>
  );
};

const ReferenceExtensionField = ({
  dataTestId,
  definition,
  isRequired,
  label,
  labelNode,
  name,
  requiredMessage,
}: ExtensionFieldProps) => {
  const [options, setOptions] = useState<DomainFormSelectItem[]>([]);
  const isMounted = useRef(true);
  const requestId = useRef(0);
  const isMulti = definition.propertyType.name === 'entityReferenceList';
  const fetchOptions = useCallback(
    async (searchText = '') => {
      const currentRequestId = ++requestId.current;

      try {
        const nextOptions = await fetchExtensionReferenceOptions(
          definition,
          searchText
        );
        if (isMounted.current && currentRequestId === requestId.current) {
          setOptions(nextOptions);
        }
      } catch {
        if (isMounted.current && currentRequestId === requestId.current) {
          setOptions([]);
        }
      }
    },
    [definition]
  );
  const debouncedSearch = useMemo(
    () => debounce((value: string) => void fetchOptions(value), 250),
    [fetchOptions]
  );
  const handleSearchChange = useCallback(
    (value: string) => {
      requestId.current++;
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      requestId.current++;
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const field: FieldProp = {
    id: `root/${name.replace('.', '/')}`,
    label: labelNode,
    name,
    placeholder: label,
    props: {
      'data-testid': dataTestId,
      filterOption: () => true,
      multiple: isMulti,
      onFocus: () => void fetchOptions(),
      onSearchChange: handleSearchChange,
      options,
    },
    required: isRequired,
    rules: { required: isRequired ? requiredMessage : false },
    type: FieldTypes.USER_TEAM_SELECT_INPUT,
  };

  return <Box direction="col">{getField(field)}</Box>;
};

const SimpleExtensionField = ({
  dataTestId,
  definition,
  isRequired,
  kind,
  label,
  labelNode,
  name,
  requiredMessage,
}: ExtensionFieldProps & {
  kind: 'duration' | 'email' | 'enum' | 'text';
}) => {
  const { t } = useTranslation();
  const config = definition.customPropertyConfig?.config;
  const enumConfig =
    typeof config === 'object' && !Array.isArray(config) ? config : undefined;
  const rules: RegisterOptions = {
    required: isRequired ? requiredMessage : false,
  };
  if (kind === 'email') {
    rules.pattern = {
      message: t('message.email-is-invalid'),
      value: EMAIL_REG_EX,
    };
  }
  const durationHint =
    kind === 'duration' ? t('message.duration-in-iso-format') : undefined;
  const enumFieldType = enumConfig?.multiSelect
    ? FieldTypes.MULTI_SELECT
    : FieldTypes.SELECT;
  const field: FieldProp = {
    id: `root/${name.replace('.', '/')}`,
    label: labelNode,
    name,
    placeholder:
      kind === 'duration' ? t('message.duration-in-iso-format') : label,
    props: {
      'data-testid': dataTestId,
      ...(kind === 'enum'
        ? {
            multiple: enumConfig?.multiSelect,
            options: (enumConfig?.values ?? []).map((value) => ({
              id: value,
              label: value,
              value,
            })),
          }
        : {}),
    },
    required: isRequired,
    rules,
    type: kind === 'enum' ? enumFieldType : FieldTypes.TEXT,
  };

  return (
    <Box direction="col">
      {getField(field)}
      {durationHint && (
        <HintText className="tw:mt-1.5">{durationHint}</HintText>
      )}
    </Box>
  );
};

/**
 * Placeholder for a configured intake property whose definition could not be
 * loaded (the custom-property request failed). A required one blocks submit via
 * a validation rule that can never pass, so the form cannot post a value it is
 * unable to type.
 */
const MissingDefinitionField = ({
  control,
  dataTestId,
  isRequired,
  label,
  name,
}: {
  control: Control<DomainFormValues>;
  dataTestId: string;
  isRequired: boolean;
  label: string;
  name: `extensionFormValues.${string}`;
}) => {
  const { t } = useTranslation();
  const message = t('message.custom-property-definition-unavailable', {
    field: label,
  });

  return (
    <FormField
      control={control}
      name={name}
      rules={{ validate: () => (isRequired ? message : true) }}>
      {({ fieldState }) => (
        <ExtensionFieldContainer
          error={fieldState.error?.message}
          isRequired={isRequired}
          label={label}>
          <Box data-testid={dataTestId} />
          {!isRequired && <HintText>{message}</HintText>}
        </ExtensionFieldContainer>
      )}
    </FormField>
  );
};

const ExtensionField = ({
  control,
  definition,
  formField,
}: {
  control: Control<DomainFormValues>;
  definition?: CustomProperty;
  formField: IntakeFormField;
}) => {
  const { t } = useTranslation();
  const propertyName = getExtensionPropertyName(formField.fieldPath);
  const name = `extensionFormValues.${getExtensionFormKey(
    propertyName
  )}` as const;
  const dataTestId = `extension-${propertyName}`;
  const label = formField.fieldLabel;
  const isRequired = Boolean(formField.required);
  const requiredMessage =
    formField.errorMessage ||
    t('label.field-required', { field: formField.fieldLabel });
  // Without the definition we cannot pick the right widget or serialize the
  // value, so a text input here would submit an untyped string and the backend
  // would reject it. Surface the failure instead of collecting a bad value.
  if (!definition) {
    return (
      <MissingDefinitionField
        control={control}
        dataTestId={dataTestId}
        isRequired={isRequired}
        label={label}
        name={name}
      />
    );
  }

  const resolvedDefinition = definition;
  const labelNode: ReactNode = definition ? (
    <Box inline align="center" gap={2}>
      {label}
      <CustomPropertyTypeBadge
        propertyTypeName={definition.propertyType.name}
      />
    </Box>
  ) : (
    label
  );
  const commonProps: ExtensionFieldProps = {
    control,
    dataTestId,
    definition: resolvedDefinition,
    isRequired,
    label,
    labelNode,
    name,
    requiredMessage,
  };
  const kind = getExtensionFieldKind(definition?.propertyType.name);

  switch (kind) {
    case 'date':
    case 'dateTime':
    case 'time':
      return <DateTimeExtensionField {...commonProps} type={kind} />;
    case 'hyperlink':
      return <HyperlinkExtensionField {...commonProps} />;
    case 'markdown':
      return <MarkdownExtensionField {...commonProps} />;
    case 'number':
      return <NumberExtensionField {...commonProps} />;
    case 'reference':
      return <ReferenceExtensionField {...commonProps} />;
    case 'sqlQuery':
      return <SqlQueryExtensionField {...commonProps} />;
    case 'table':
      return <TableExtensionField {...commonProps} />;
    case 'timeInterval':
      return <TimeIntervalExtensionField {...commonProps} />;
    case 'timestamp':
      return <NumberExtensionField {...commonProps} timestamp />;
    case 'duration':
    case 'email':
    case 'enum':
    case 'text':
      return <SimpleExtensionField {...commonProps} kind={kind} />;
  }
};

const AddDomainFormExtensionFields = ({
  control,
  customProperties,
  formFields,
}: AddDomainFormExtensionFieldsProps) => {
  const definitionsByName = useMemo(
    () =>
      new Map(
        customProperties.map((definition) => [definition.name, definition])
      ),
    [customProperties]
  );

  if (!formFields.length) {
    return null;
  }

  return (
    <Box data-testid="custom-properties-section" direction="col" gap={6}>
      {formFields.map((formField) => {
        const propertyName = getExtensionPropertyName(formField.fieldPath);

        return (
          <ExtensionField
            control={control}
            definition={definitionsByName.get(propertyName)}
            formField={formField}
            key={formField.fieldPath}
          />
        );
      })}
    </Box>
  );
};

export default AddDomainFormExtensionFields;
