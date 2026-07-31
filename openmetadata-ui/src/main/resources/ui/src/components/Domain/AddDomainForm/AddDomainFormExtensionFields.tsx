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

import {
  Autocomplete,
  InputBase,
  Select as CoreSelect,
  type SelectItemType,
} from '@openmetadata/ui-core-components';
import { Form } from 'antd';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../generated/entity/type';
import { IntakeFormField } from '../../../generated/governance/intakeForm';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { getField } from '../../../utils/formUtils';
import CustomPropertyTypeBadge from '../../common/CustomPropertyTypeBadge/CustomPropertyTypeBadge.component';
import {
  getExtensionFieldKind,
} from './AddDomainFormExtensionFields.utils';

// ---------------------------------------------------------------------------
// CoreTextInput — bridges antd Form.Item (ChangeEventHandler) with InputBase
// ---------------------------------------------------------------------------

interface CoreTextInputProps {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
  id?: string;
  'data-testid'?: string;
}

const CoreTextInput: React.FC<CoreTextInputProps> = ({
  value,
  onChange,
  placeholder,
  type,
  id,
  'data-testid': testId,
}) => (
  <InputBase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {...({ id, type, 'data-testid': testId, value: value ?? '', onChange, placeholder } as any)}
  />
);

// ---------------------------------------------------------------------------
// CoreDateInput — wraps InputBase for date / dateTime / time fields
// ---------------------------------------------------------------------------

interface CoreDateInputProps {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  dateKind: 'date' | 'dateTime' | 'time';
  'data-testid'?: string;
}

/**
 * Bridges antd Form.Item with InputBase for date/dateTime/time. Converts
 * between HTML datetime-local format ("YYYY-MM-DDTHH:MM:SS") and the stored
 * format ("YYYY-MM-DD HH:MM:SS") for dateTime fields.
 */
const CoreDateInput: React.FC<CoreDateInputProps> = ({
  value,
  onChange,
  dateKind,
  'data-testid': testId,
}) => {
  const inputType = dateKind === 'dateTime' ? 'datetime-local' : dateKind;
  const htmlValue =
    dateKind === 'dateTime' && value ? value.replace(' ', 'T') : (value ?? '');

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const raw = e.target.value;
    const stored = dateKind === 'dateTime' ? raw.replace('T', ' ') : raw;
    onChange?.({
      ...e,
      target: { ...e.target, value: stored },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <InputBase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({
        type: inputType,
        step: dateKind !== 'date' ? '1' : undefined,
        'data-testid': testId,
        value: htmlValue,
        onChange: handleChange,
      } as any)}
    />
  );
};

// ---------------------------------------------------------------------------
// CoreEnumSelect — single-select enum using core Select (chevron dropdown)
// ---------------------------------------------------------------------------

interface CoreEnumSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectItemType[];
  placeholder?: string;
  'data-testid'?: string;
}

const CoreEnumSelect: React.FC<CoreEnumSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  'data-testid': testId,
}) => (
  <div data-testid={testId}>
    <CoreSelect
      items={options}
      placeholder={placeholder}
      selectedKey={value ?? null}
      onSelectionChange={(key) => {
        if (key !== null) onChange?.(String(key));
      }}>
      {(item) => <CoreSelect.Item id={String(item.id)} label={item.label} />}
    </CoreSelect>
  </div>
);

// ---------------------------------------------------------------------------
// CoreEnumMultiSelect — multi-select enum using core Autocomplete chip-picker
// ---------------------------------------------------------------------------

interface CoreEnumMultiSelectProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  options: SelectItemType[];
  placeholder?: string;
  'data-testid'?: string;
}

const CoreEnumMultiSelect: React.FC<CoreEnumMultiSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  'data-testid': testId,
}) => {
  const currentValues = Array.isArray(value) ? value : [];
  const selected = currentValues
    .map((v) => options.find((o) => o.id === v))
    .filter((o): o is SelectItemType => o !== undefined);

  return (
    <div data-testid={testId}>
      <Autocomplete
        items={options}
        multiple
        placeholder={placeholder}
        placeholderIcon={null}
        selectedItems={selected}
        onItemCleared={(key) =>
          onChange?.(currentValues.filter((v) => v !== String(key)))
        }
        onItemInserted={(key) =>
          onChange?.([...currentValues, String(key)])
        }>
        {(item) => <Autocomplete.Item id={String(item.id)} label={item.label} />}
      </Autocomplete>
    </div>
  );
};

// ---------------------------------------------------------------------------
// CoreEntityRefSelect — async entity-reference picker using core Autocomplete
// ---------------------------------------------------------------------------

interface CoreEntityRefSelectProps {
  allowedTypes: string[];
  label: string;
  multiple?: boolean;
  'data-testid': string;
  value?: Record<string, unknown> | Record<string, unknown>[];
  onChange?: (
    val: Record<string, unknown> | Record<string, unknown>[] | undefined
  ) => void;
}

/**
 * Replaces the old antd-based ExtensionEntityRefSelect. Uses core Autocomplete
 * for a consistent look; searches entities via the API on user input.
 * Lives as a standalone component so hooks (useState / useRef) are valid here.
 */
const CoreEntityRefSelect: React.FC<CoreEntityRefSelectProps> = ({
  allowedTypes,
  label,
  multiple = false,
  'data-testid': testId,
  value,
  onChange,
}) => {
  const [searchItems, setSearchItems] = useState<SelectItemType[]>([]);
  const optionMapRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  const searchIndex = (allowedTypes[0] ?? 'glossaryTerm') as string;

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query) {
        setSearchItems([]);

        return;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (searchQuery as any)({
          query: `*${query}*`,
          pageNumber: 1,
          pageSize: 15,
          queryFilter: {},
          searchIndex,
        });
        const hits = (result?.hits?.hits ?? []) as Array<{
          _id: string;
          _source?: {
            name?: string;
            displayName?: string;
            fullyQualifiedName?: string;
            entityType?: string;
          };
        }>;
        const items: SelectItemType[] = hits.map((hit) => ({
          id: String(hit._id),
          label:
            hit._source?.displayName ||
            hit._source?.name ||
            String(hit._id),
        }));
        setSearchItems(items);
        hits.forEach((hit) => {
          optionMapRef.current.set(String(hit._id), {
            id: hit._id,
            type: hit._source?.entityType || searchIndex,
            name: hit._source?.name,
            displayName: hit._source?.displayName,
            fullyQualifiedName: hit._source?.fullyQualifiedName,
          });
        });
      } catch {
        setSearchItems([]);
      }
    },
    [searchIndex]
  );

  const currentValues: Array<Record<string, unknown>> = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : value ? [value] : [];
    }

    return value && !Array.isArray(value) ? [value] : [];
  }, [value, multiple]);

  const selectedItems: SelectItemType[] = useMemo(
    () =>
      currentValues
        .filter((v) => v && typeof v.id === 'string')
        .map((v) => ({
          id: String(v.id),
          label: String(v.displayName || v.name || v.id),
        })),
    [currentValues]
  );

  return (
    <div data-testid={testId}>
      <Autocomplete
        allowsEmptyCollection
        filterOption={() => true}
        items={searchItems}
        multiple={multiple}
        placeholder={label}
        selectedItems={selectedItems}
        onItemCleared={(key) => {
          if (multiple) {
            const next = currentValues.filter((v) => String(v.id) !== String(key));
            onChange?.(next);
          } else {
            onChange?.(undefined);
          }
        }}
        onItemInserted={(key) => {
          const ref = optionMapRef.current.get(String(key));
          if (!ref) {
            return;
          }
          if (multiple) {
            onChange?.([...currentValues, ref]);
          } else {
            onChange?.(ref);
          }
        }}
        onSearchChange={handleSearch}>
        {(item) => (
          <Autocomplete.Item id={String(item.id)} label={item.label} />
        )}
      </Autocomplete>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AddDomainFormExtensionFieldsProps {
  customProperties: CustomProperty[];
  formFields: IntakeFormField[];
}

const AddDomainFormExtensionFields = ({
  customProperties,
  formFields,
}: AddDomainFormExtensionFieldsProps) => {
  const { t } = useTranslation();

  if (formFields.length === 0) {
    return null;
  }

  return (
    <div className="m-t-xss" data-testid="custom-properties-section">
      {formFields.map((formField) => {
        const propertyName = formField.fieldPath.startsWith('extension.')
          ? formField.fieldPath.slice('extension.'.length)
          : formField.fieldPath;

        const definition = customProperties.find(
          (cp) => cp.name === propertyName
        );

        const propertyTypeName = definition?.propertyType?.name;
        const kind = getExtensionFieldKind(propertyTypeName);
        const label = formField.fieldLabel;
        const isRequired = formField.required ?? false;
        const requiredMessage =
          formField.errorMessage ||
          t('label.field-required', { field: label });

        const baseRules = isRequired
          ? [{ required: true, message: requiredMessage }]
          : [];

        const namePath = ['extension', propertyName];
        const dataTestId = `extension-${propertyName}`;

        const labelWithBadge = (
          <>
            {label}
            <CustomPropertyTypeBadge propertyTypeName={propertyTypeName} />
          </>
        );

        if (kind === 'text' || kind === 'duration' || kind === 'unknown') {
          return (
            <Form.Item
              key={formField.fieldPath}
              label={labelWithBadge}
              name={namePath}
              rules={baseRules}>
              <CoreTextInput
                data-testid={dataTestId}
                placeholder={label}
              />
            </Form.Item>
          );
        }

        if (kind === 'email') {
          return (
            <Form.Item
              key={formField.fieldPath}
              label={labelWithBadge}
              name={namePath}
              rules={[
                ...baseRules,
                { type: 'email' as const, message: t('message.email-is-invalid') },
              ]}>
              <CoreTextInput
                data-testid={dataTestId}
                placeholder={label}
                type="email"
              />
            </Form.Item>
          );
        }

        if (kind === 'enum' || kind === 'enumMultiSelect') {
          const config = definition?.customPropertyConfig?.config as
            | { values?: string[]; multiSelect?: boolean }
            | undefined;
          const enumOptions: SelectItemType[] = (config?.values ?? []).map(
            (v) => ({ id: v, label: v })
          );
          const isMulti = kind === 'enumMultiSelect' || config?.multiSelect;

          if (isMulti) {
            return (
              <Form.Item
                key={formField.fieldPath}
                label={labelWithBadge}
                name={namePath}
                rules={baseRules}>
                <CoreEnumMultiSelect
                  data-testid={dataTestId}
                  options={enumOptions}
                  placeholder={label}
                />
              </Form.Item>
            );
          }

          return (
            <Form.Item
              key={formField.fieldPath}
              label={labelWithBadge}
              name={namePath}
              rules={baseRules}>
              <CoreEnumSelect
                data-testid={dataTestId}
                options={enumOptions}
                placeholder={label}
              />
            </Form.Item>
          );
        }

        if (kind === 'number' || kind === 'timestamp') {
          return (
            <Form.Item
              key={formField.fieldPath}
              label={labelWithBadge}
              name={namePath}
              rules={baseRules}>
              <CoreTextInput
                data-testid={dataTestId}
                placeholder={label}
                type="number"
              />
            </Form.Item>
          );
        }

        if (kind === 'date' || kind === 'dateTime') {
          return (
            <Form.Item
              key={formField.fieldPath}
              label={labelWithBadge}
              name={namePath}
              rules={baseRules}>
              <CoreDateInput dateKind={kind} data-testid={dataTestId} />
            </Form.Item>
          );
        }

        if (kind === 'time') {
          return (
            <Form.Item
              key={formField.fieldPath}
              label={labelWithBadge}
              name={namePath}
              rules={baseRules}>
              <CoreDateInput dateKind="time" data-testid={dataTestId} />
            </Form.Item>
          );
        }

        if (kind === 'hyperlink') {
          return (
            <Form.Item
              key={formField.fieldPath}
              label={labelWithBadge}>
              <Form.Item
                name={[...namePath, 'url']}
                noStyle
                rules={[
                  ...(isRequired
                    ? [{ required: true, message: requiredMessage }]
                    : []),
                  {
                    validator: (_: unknown, val: string) => {
                      if (!val) {
                        return Promise.resolve();
                      }
                      if (/^https?:\/\//i.test(val)) {
                        return Promise.resolve();
                      }

                      return Promise.reject(
                        new Error(t('message.url-must-use-http-or-https'))
                      );
                    },
                  },
                ]}>
                <CoreTextInput
                  data-testid={`${dataTestId}-url`}
                  placeholder={t('label.url-lowercase')}
                />
              </Form.Item>
              <div style={{ marginTop: 8 }}>
                <Form.Item name={[...namePath, 'displayText']} noStyle>
                  <CoreTextInput
                    data-testid={`${dataTestId}-displayText`}
                    placeholder={t('label.display-name')}
                  />
                </Form.Item>
              </div>
            </Form.Item>
          );
        }

        if (kind === 'markdown') {
          const fieldProp: FieldProp = {
            id: `root/extension/${propertyName}`,
            label,
            name: namePath as string[],
            required: isRequired,
            rules: baseRules,
            type: FieldTypes.DESCRIPTION,
            props: {
              'data-testid': dataTestId,
              initialValue: '',
              height: 'auto',
            },
          };

          return <div key={formField.fieldPath}>{getField(fieldProp)}</div>;
        }

        if (kind === 'timeInterval') {
          return (
            <Form.Item
              key={formField.fieldPath}
              label={labelWithBadge}>
              <Form.Item
                name={[...namePath, 'start']}
                noStyle
                rules={
                  isRequired
                    ? [{ required: true, message: requiredMessage }]
                    : []
                }>
                <CoreTextInput
                  data-testid={`${dataTestId}-start`}
                  placeholder={t('label.start')}
                  type="number"
                />
              </Form.Item>
              <div style={{ marginTop: 8 }}>
                <Form.Item
                  name={[...namePath, 'end']}
                  noStyle
                  rules={
                    isRequired
                      ? [{ required: true, message: requiredMessage }]
                      : []
                  }>
                  <CoreTextInput
                    data-testid={`${dataTestId}-end`}
                    placeholder={t('label.end')}
                    type="number"
                  />
                </Form.Item>
              </div>
            </Form.Item>
          );
        }

        if (kind === 'reference' || kind === 'referenceList') {
          const config = definition?.customPropertyConfig?.config;
          const allowedTypes = Array.isArray(config)
            ? (config as string[])
            : typeof config === 'string'
            ? [config]
            : ['glossaryTerm'];

          const isUserOrTeam = allowedTypes.every(
            (t) => t === 'user' || t === 'team'
          );

          if (isUserOrTeam) {
            const fieldProp: FieldProp = {
              id: `root/extension/${propertyName}`,
              label,
              name: namePath as string[],
              required: isRequired,
              rules: baseRules,
              type: FieldTypes.USER_TEAM_SELECT_MUI,
              props: {
                'data-testid': dataTestId,
                label,
                multipleUser: kind === 'referenceList',
                userOnly: !allowedTypes.includes('team'),
              },
              formItemProps: {
                valuePropName: 'value',
                trigger: 'onChange',
              },
            };

            return <div key={formField.fieldPath}>{getField(fieldProp)}</div>;
          }

          return (
            <Form.Item
              key={formField.fieldPath}
              label={labelWithBadge}
              name={namePath}
              rules={baseRules}>
              <CoreEntityRefSelect
                allowedTypes={allowedTypes}
                data-testid={dataTestId}
                label={label}
                multiple={kind === 'referenceList'}
              />
            </Form.Item>
          );
        }

        return (
          <Form.Item
            key={formField.fieldPath}
            label={labelWithBadge}
            name={namePath}
            rules={baseRules}>
            <CoreTextInput
              data-testid={dataTestId}
              placeholder={label}
            />
          </Form.Item>
        );
      })}
    </div>
  );
};

export default AddDomainFormExtensionFields;
