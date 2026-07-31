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

import { InputBase } from '@openmetadata/ui-core-components';
import { DatePicker, Form, Select, TimePicker } from 'antd';
import React, { useCallback, useState } from 'react';
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

/**
 * Thin adapter so InputBase (react-aria onChange: (value: string) => void)
 * works with antd Form.Item (onChange: React.ChangeEventHandler).
 */
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

interface AddDomainFormExtensionFieldsProps {
  customProperties: CustomProperty[];
  formFields: IntakeFormField[];
}

interface EntityRefOption {
  label: string;
  value: string;
  ref: Record<string, unknown>;
}

interface ExtensionEntityRefSelectProps {
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
 * A standalone combobox for picking an entity reference via the search API.
 * Lives in its own component so we can use `useState` without violating the
 * rules-of-hooks (parent maps over `formFields`).
 */
const ExtensionEntityRefSelect: React.FC<ExtensionEntityRefSelectProps> = ({
  allowedTypes,
  label,
  multiple = false,
  'data-testid': testId,
  value,
  onChange,
}) => {
  const [options, setOptions] = useState<EntityRefOption[]>([]);
  const [searching, setSearching] = useState(false);
  const searchIndex = (allowedTypes[0] ?? 'glossaryTerm') as string;

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query) {
        return;
      }
      setSearching(true);
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
        setOptions(
          hits.map((hit) => ({
            label:
              hit._source?.displayName ||
              hit._source?.name ||
              String(hit._id),
            value: String(hit._id),
            ref: {
              id: hit._id,
              type: hit._source?.entityType || searchIndex,
              name: hit._source?.name,
              displayName: hit._source?.displayName,
              fullyQualifiedName: hit._source?.fullyQualifiedName,
            },
          }))
        );
      } catch {
        setOptions([]);
      } finally {
        setSearching(false);
      }
    },
    [searchIndex]
  );

  const toId = (ref: Record<string, unknown>) =>
    'id' in ref ? String(ref.id) : undefined;

  const currentValue = multiple
    ? (Array.isArray(value) ? value : value ? [value] : [])
        .map((v) => toId(v))
        .filter((id): id is string => id !== undefined)
    : Array.isArray(value)
    ? undefined
    : value && 'id' in value
    ? toId(value)
    : undefined;

  return (
    <div data-testid={testId}>
      <Select
        allowClear
        aria-label={label}
        filterOption={false}
        loading={searching}
        mode={multiple ? 'multiple' : undefined}
        placeholder={label}
        showSearch
        style={{ width: '100%' }}
        value={currentValue}
        onChange={(val) => {
          if (multiple) {
            const ids = Array.isArray(val) ? val : val ? [val] : [];
            const refs = ids
              .map((id: string) => options.find((o) => o.value === id)?.ref)
              .filter((ref): ref is Record<string, unknown> => ref !== undefined);
            onChange?.(refs);
          } else {
            const found = options.find((o) => o.value === String(val));
            onChange?.(found ? found.ref : undefined);
          }
        }}
        onSearch={handleSearch}>
        {options.map((opt) => (
          <Select.Option key={opt.value} value={opt.value}>
            {opt.label}
          </Select.Option>
        ))}
      </Select>
    </div>
  );
};

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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {label}
            <CustomPropertyTypeBadge propertyTypeName={propertyTypeName} />
          </span>
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
          const options = (config?.values ?? []).map((v) => ({
            label: v,
            value: v,
          }));
          const isMulti = kind === 'enumMultiSelect' || config?.multiSelect;
          const fieldProp: FieldProp = {
            id: `root/extension/${propertyName}`,
            label: labelWithBadge,
            name: namePath as string[],
            required: isRequired,
            rules: baseRules,
            type: FieldTypes.SELECT,
            props: {
              'data-testid': dataTestId,
              options,
              ...(isMulti ? { mode: 'multiple' } : {}),
            },
          };

          return <div key={formField.fieldPath}>{getField(fieldProp)}</div>;
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
              <DatePicker
                className="w-full"
                data-testid={dataTestId}
                showTime={kind === 'dateTime'}
              />
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
              <TimePicker className="w-full" data-testid={dataTestId} />
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
              <Form.Item
                name={[...namePath, 'displayText']}
                noStyle
                style={{ marginTop: 8 }}>
                <CoreTextInput
                  data-testid={`${dataTestId}-displayText`}
                  placeholder={t('label.display-name')}
                />
              </Form.Item>
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
              <Form.Item
                name={[...namePath, 'end']}
                noStyle
                style={{ marginTop: 8 }}
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
              <ExtensionEntityRefSelect
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
