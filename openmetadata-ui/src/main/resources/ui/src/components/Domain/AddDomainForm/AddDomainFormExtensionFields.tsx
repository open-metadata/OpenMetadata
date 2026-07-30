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

import { DatePicker, Form, Input, InputNumber, TimePicker } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../generated/entity/type';
import { IntakeFormField } from '../../../generated/governance/intakeForm';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { getField } from '../../../utils/formUtils';
import {
  getExtensionFieldKind,
} from './AddDomainFormExtensionFields.utils';

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
    <>
      {formFields.map((formField) => {
        // fieldPath for custom props is like "extension.propName"
        const propertyName = formField.fieldPath.startsWith('extension.')
          ? formField.fieldPath.slice('extension.'.length)
          : formField.fieldPath;

        const definition = customProperties.find(
          (cp) => cp.name === propertyName
        );

        const kind = getExtensionFieldKind(definition?.propertyType?.name);
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

        // Simple text types: use FieldProp/getField pattern
        if (kind === 'text' || kind === 'duration' || kind === 'unknown') {
          const fieldProp: FieldProp = {
            id: `root/extension/${propertyName}`,
            label,
            name: namePath as string[],
            required: isRequired,
            rules: baseRules,
            type: FieldTypes.TEXT,
            props: { 'data-testid': dataTestId },
          };

          return <div key={formField.fieldPath}>{getField(fieldProp)}</div>;
        }

        if (kind === 'email') {
          const fieldProp: FieldProp = {
            id: `root/extension/${propertyName}`,
            label,
            name: namePath as string[],
            required: isRequired,
            rules: [
              ...baseRules,
              { type: 'email' as const, message: t('message.email-is-invalid') },
            ],
            type: FieldTypes.TEXT,
            props: { 'data-testid': dataTestId, type: 'email' },
          };

          return <div key={formField.fieldPath}>{getField(fieldProp)}</div>;
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
            label,
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
              label={label}
              name={namePath}
              rules={baseRules}>
              <InputNumber
                className="w-full"
                data-testid={dataTestId}
                placeholder={label}
              />
            </Form.Item>
          );
        }

        if (kind === 'date' || kind === 'dateTime') {
          return (
            <Form.Item
              key={formField.fieldPath}
              label={label}
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
              label={label}
              name={namePath}
              rules={baseRules}>
              <TimePicker className="w-full" data-testid={dataTestId} />
            </Form.Item>
          );
        }

        if (kind === 'hyperlink') {
          return (
            <Form.Item key={formField.fieldPath} label={label}>
              <Form.Item
                name={[...namePath, 'name']}
                noStyle
                rules={
                  isRequired
                    ? [{ required: true, message: requiredMessage }]
                    : []
                }>
                <Input
                  data-testid={`${dataTestId}-name`}
                  placeholder={t('label.name')}
                />
              </Form.Item>
              <Form.Item
                name={[...namePath, 'href']}
                noStyle
                rules={
                  isRequired
                    ? [
                        { required: true, message: requiredMessage },
                        {
                          type: 'url' as const,
                          message: t('label.invalid-url'),
                        },
                      ]
                    : [
                        {
                          type: 'url' as const,
                          message: t('label.invalid-url'),
                        },
                      ]
                }>
                <Input
                  className="m-t-xs"
                  data-testid={`${dataTestId}-href`}
                  placeholder={t('label.url-lowercase')}
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
            <Form.Item key={formField.fieldPath} label={label}>
              <Form.Item
                name={[...namePath, 'start']}
                noStyle
                rules={
                  isRequired
                    ? [{ required: true, message: requiredMessage }]
                    : []
                }>
                <InputNumber
                  className="w-full m-b-xs"
                  data-testid={`${dataTestId}-start`}
                  placeholder={t('label.start')}
                />
              </Form.Item>
              <Form.Item
                name={[...namePath, 'end']}
                noStyle
                rules={
                  isRequired
                    ? [{ required: true, message: requiredMessage }]
                    : []
                }>
                <InputNumber
                  className="w-full"
                  data-testid={`${dataTestId}-end`}
                  placeholder={t('label.end')}
                />
              </Form.Item>
            </Form.Item>
          );
        }

        // sqlQuery, reference, referenceList, table: fall back to text input
        const fallbackFieldProp: FieldProp = {
          id: `root/extension/${propertyName}`,
          label,
          name: namePath as string[],
          required: isRequired,
          rules: baseRules,
          type: FieldTypes.TEXT,
          props: { 'data-testid': dataTestId },
        };

        return (
          <div key={formField.fieldPath}>{getField(fallbackFieldProp)}</div>
        );
      })}
    </>
  );
};

export default AddDomainFormExtensionFields;
