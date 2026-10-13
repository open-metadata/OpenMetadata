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
  Box,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  getField,
  HintText,
  useFieldDoc,
} from '@openmetadata/ui-core-components';
import { isArray, map, startCase } from 'lodash';
import React, { ReactNode, useMemo } from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  CUSTOM_PROPERTIES_ICON_MAP,
  ENTITY_REFERENCE_OPTIONS,
} from '../../../../../../constants/CustomProperty.constants';
import { CUSTOM_PROPERTY_NAME_REGEX } from '../../../../../../constants/regex.constants';
import { Type } from '../../../../../../generated/entity/type';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { RESERVED_TABLE_COLUMN_NAMES } from './CustomPropertiesPanel.constants';
import {
  AddCustomPropertyFormValues,
  DescriptionFormFieldProps,
} from './CustomPropertiesPanel.types';
import {
  getCustomPropertyTypeFlags,
  toId,
} from './CustomPropertiesPanel.utils';

interface CustomPropertyFormFieldsProps {
  form: UseFormReturn<AddCustomPropertyFormValues>;
  propertyTypes: Type[];
  descriptionKey: number;
  /** Rendered right after the type select. */
  typeAddon?: ReactNode;
}

const DescriptionFormField: React.FC<
  DescriptionFormFieldProps<AddCustomPropertyFormValues>
> = ({ form, descriptionKey, initialValue = '' }) => {
  const { t } = useTranslation();
  const descriptionDocProps = useFieldDoc({
    name: 'description',
    label: t('label.description'),
    doc: t('message.custom-property-description-help'),
  });

  return (
    <FormField
      control={form.control}
      name="description"
      rules={{
        required: t('label.field-required', {
          field: t('label.description'),
        }),
      }}>
      {({ field, fieldState }) => (
        <Box
          aria-invalid={fieldState.invalid || undefined}
          className="tw:gap-1.5"
          direction="col"
          {...descriptionDocProps}>
          <FormItemLabel required label={t('label.description')} />
          <RichTextEditor
            className="description-text-area new-form-style"
            initialValue={initialValue}
            key={descriptionKey}
            onTextChange={field.onChange}
          />
          {fieldState.error?.message && (
            <HintText isInvalid>{fieldState.error.message}</HintText>
          )}
        </Box>
      )}
    </FormField>
  );
};

/** The add-custom-property fields shared by the AI panel and the settings page. */
const CustomPropertyFormFields = ({
  form,
  propertyTypes,
  descriptionKey,
  typeAddon,
}: CustomPropertyFormFieldsProps) => {
  const { t } = useTranslation();
  const watchedPropertyType = useWatch({
    control: form.control,
    name: 'propertyType',
  });

  const propertyTypeOptions = useMemo(
    () =>
      map(propertyTypes, (type) => {
        const IconComp =
          CUSTOM_PROPERTIES_ICON_MAP[
            type.name as keyof typeof CUSTOM_PROPERTIES_ICON_MAP
          ];

        return {
          id: type.id ?? '',
          label: startCase(getEntityName(type).replaceAll('-cp', '')),
          icon: IconComp,
        };
      }),
    [propertyTypes]
  );

  const {
    hasEnumConfig,
    hasFormatConfig,
    hasEntityReferenceConfig,
    hasTableTypeConfig,
    supportedFormats,
  } = getCustomPropertyTypeFlags(propertyTypes, watchedPropertyType);

  const nameField: FieldProp = useMemo(
    () => ({
      name: 'name',
      id: 'root/name',
      label: t('label.name'),
      type: FieldTypes.TEXT,
      required: true,
      placeholder: t('label.name'),
      doc: t('message.custom-property-name-help'),
      props: { 'data-testid': 'custom-property-name' },
      rules: {
        required: t('label.field-required', { field: t('label.name') }),
        maxLength: {
          value: 256,
          message: t('message.entity-size-in-between', {
            entity: t('label.name'),
            min: 1,
            max: 256,
          }),
        },
        pattern: {
          value: CUSTOM_PROPERTY_NAME_REGEX,
          message: t('message.custom-property-name-validation'),
        },
      },
    }),
    [t]
  );

  const displayNameField: FieldProp = useMemo(
    () => ({
      name: 'displayName',
      id: 'root/displayName',
      label: t('label.display-name'),
      type: FieldTypes.TEXT,
      required: false,
      placeholder: t('label.display-name'),
      doc: t('message.custom-property-display-name-help'),
      props: { 'data-testid': 'custom-property-display-name' },
    }),
    [t]
  );

  const propertyTypeField: FieldProp = useMemo(
    () => ({
      name: 'propertyType',
      id: 'root/propertyType',
      label: t('label.type'),
      type: FieldTypes.SELECT,
      required: true,
      placeholder: t('label.select-field', { field: t('label.type') }),
      doc: t('message.custom-property-type-help'),
      rules: {
        required: t('label.field-required', { field: t('label.type') }),
      },
      props: {
        'data-testid': 'custom-property-type',
        items: propertyTypeOptions,
      },
    }),
    [t, propertyTypeOptions]
  );

  const enumConfigField: FieldProp = useMemo(
    () => ({
      name: 'enumConfig',
      id: 'root/enumConfig',
      label: t('label.enum-value-plural'),
      type: FieldTypes.MULTI_SELECT,
      required: true,
      placeholder: t('label.enum-value-plural'),
      doc: t('message.custom-property-enum-config-help'),
      rules: {
        required: t('label.field-required', {
          field: t('label.enum-value-plural'),
        }),
      },
      props: {
        'data-testid': 'custom-property-enum-config',
        allowsCreation: true,
        items: [],
      },
    }),
    [t]
  );

  const multiSelectField: FieldProp = useMemo(
    () => ({
      name: 'multiSelect',
      id: 'root/multiSelect',
      label: t('label.multi-select'),
      type: FieldTypes.SWITCH,
      required: false,
      doc: t('message.custom-property-multi-select-help'),
      props: { 'data-testid': 'custom-property-multi-select' },
    }),
    [t]
  );

  const formatConfigField: FieldProp = useMemo(
    () => ({
      name: 'formatConfig',
      id: 'root/formatConfig',
      label: t('label.format'),
      type: FieldTypes.SELECT,
      required: false,
      placeholder: t('label.format'),
      doc: t('message.custom-property-format-config-help'),
      rules: {
        validate: (value: AddCustomPropertyFormValues['formatConfig']) => {
          const id = toId(value ?? undefined);
          if (id && !supportedFormats.includes(id)) {
            return t('label.field-invalid', { field: t('label.format') });
          }

          return true;
        },
      },
      props: {
        'data-testid': 'custom-property-format-config',
        items: supportedFormats.map((fmt) => ({ id: fmt, label: fmt })),
      },
    }),
    [t, supportedFormats]
  );

  const entityReferenceConfigField: FieldProp = useMemo(
    () => ({
      name: 'entityReferenceConfig',
      id: 'root/entityReferenceConfig',
      label: t('label.entity-reference-types'),
      type: FieldTypes.MULTI_SELECT,
      required: true,
      placeholder: t('label.select-field', { field: t('label.type') }),
      doc: t('message.custom-property-entity-reference-config-help'),
      rules: {
        required: t('label.field-required', {
          field: t('label.entity-reference-types'),
        }),
      },
      props: {
        'data-testid': 'custom-property-entity-ref-config',
        items: ENTITY_REFERENCE_OPTIONS.map((opt) => ({
          id: opt.value,
          label: opt.label,
        })),
      },
    }),
    [t]
  );

  const columnsField: FieldProp = useMemo(
    () => ({
      name: 'columns',
      id: 'root/columns',
      label: t('label.column-plural'),
      type: FieldTypes.MULTI_SELECT,
      required: true,
      placeholder: t('label.column-plural'),
      rules: {
        required: t('label.field-required', {
          field: t('label.column-plural'),
        }),
        validate: (value: AddCustomPropertyFormValues['columns']) => {
          if (isArray(value) && value.length > 3) {
            return t('message.maximum-count-allowed', {
              count: 3,
              label: t('label.column-plural'),
            });
          }
          if (
            value?.some((column) =>
              RESERVED_TABLE_COLUMN_NAMES.includes(toId(column))
            )
          ) {
            return t('message.reserved-column-name', {
              name: RESERVED_TABLE_COLUMN_NAMES.join(', '),
            });
          }

          return true;
        },
      },
      props: {
        'data-testid': 'custom-property-columns',
        allowsCreation: true,
        items: [],
      },
    }),
    [t]
  );

  return (
    <>
      <Box gap={4}>
        <Box className="tw:flex-1" direction="col">
          {getField(nameField)}
        </Box>
        <Box className="tw:flex-1" direction="col">
          {getField(displayNameField)}
        </Box>
      </Box>
      {getField(propertyTypeField)}
      {typeAddon}
      {hasEnumConfig && (
        <>
          {getField(enumConfigField)}
          {getField(multiSelectField)}
        </>
      )}
      {hasFormatConfig && getField(formatConfigField)}
      {hasEntityReferenceConfig && getField(entityReferenceConfigField)}
      {hasTableTypeConfig && getField(columnsField)}
      <DescriptionFormField descriptionKey={descriptionKey} form={form} />
    </>
  );
};

export default CustomPropertyFormFields;
