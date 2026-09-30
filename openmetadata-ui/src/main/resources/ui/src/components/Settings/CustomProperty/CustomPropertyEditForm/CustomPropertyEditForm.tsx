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
  HookForm,
  Typography,
  useFieldDoc,
} from '@openmetadata/ui-core-components';
import { FC, useEffect, useMemo, useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ENTITY_REFERENCE_OPTIONS,
  ENUM_CONFIG_MAX_VISIBLE_VALUES,
} from '../../../../constants/CustomProperty.constants';
import RichTextEditor from '../../../common/RichTextEditor/RichTextEditor';
import {
  CustomPropertyEditFormProps,
  EditCustomPropertyFormValues,
} from './CustomPropertyEditForm.interface';
import {
  getCustomPropertyChanges,
  getEditFormValues,
  getEnumConfig,
  isEntityReferenceProperty,
  isEnumProperty,
} from './CustomPropertyEditForm.utils';

// A child of HookForm: useFieldDoc reads the form's field-doc context.
const DescriptionFormField: FC<{
  form: UseFormReturn<EditCustomPropertyFormValues>;
  editorKey: number;
  initialValue: string;
}> = ({ form, editorKey, initialValue }) => {
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
            key={editorKey}
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

const CustomPropertyEditForm: FC<CustomPropertyEditFormProps> = ({
  property,
  formId,
  showHint = false,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const isEnum = isEnumProperty(property);
  const isEntityRef = isEntityReferenceProperty(property);

  const form = useForm<EditCustomPropertyFormValues>({
    defaultValues: getEditFormValues(property),
  });

  // The rich-text editor is uncontrolled, so a new property remounts it.
  const [editorKey, setEditorKey] = useState(0);
  useEffect(() => {
    form.reset(getEditFormValues(property));
    setEditorKey((key) => key + 1);
  }, [property, form]);

  const existingEnumItems = useMemo(
    () =>
      (getEnumConfig(property)?.values ?? []).map((value) => ({
        id: value,
        label: value,
      })),
    [property]
  );

  const displayNameField: FieldProp = {
    name: 'displayName',
    label: t('label.display-name'),
    type: FieldTypes.TEXT,
    required: false,
    placeholder: t('label.display-name'),
    doc: t('message.custom-property-display-name-help'),
    props: { 'data-testid': 'edit-custom-property-display-name' },
  };

  const enumConfigField: FieldProp = {
    name: 'enumConfig',
    label: t('label.enum-value-plural'),
    type: FieldTypes.MULTI_SELECT,
    required: false,
    placeholder: t('label.enum-value-plural'),
    doc: t('message.custom-property-enum-config-help'),
    props: {
      'data-testid': 'edit-custom-property-enum-config',
      allowsCreation: true,
      items: existingEnumItems,
      maxVisibleItems: ENUM_CONFIG_MAX_VISIBLE_VALUES,
    },
  };

  const multiSelectField: FieldProp = {
    name: 'multiSelect',
    label: t('label.multi-select'),
    type: FieldTypes.SWITCH,
    required: false,
    doc: t('message.custom-property-multi-select-help'),
    props: { 'data-testid': 'edit-custom-property-multi-select' },
  };

  const entityReferenceConfigField: FieldProp = {
    name: 'entityReferenceConfig',
    label: t('label.entity-reference-types'),
    type: FieldTypes.MULTI_SELECT,
    required: false,
    placeholder: t('label.select-field', { field: t('label.type') }),
    doc: t('message.custom-property-entity-reference-config-help'),
    props: {
      'data-testid': 'edit-custom-property-entity-ref-config',
      items: ENTITY_REFERENCE_OPTIONS.map((option) => ({
        id: option.value,
        label: option.label,
      })),
    },
  };

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-6"
      data-testid="edit-custom-property-form"
      fieldDocDisplay="popover"
      form={form}
      id={formId}
      renderFieldDoc={(text) => (
        <Typography className="tw:text-tertiary" size="text-sm">
          {text}
        </Typography>
      )}
      showFieldDocs={showHint}
      onSubmit={form.handleSubmit((values) =>
        onSubmit(getCustomPropertyChanges(property, values))
      )}>
      {getField(displayNameField)}
      {isEnum && (
        <>
          {getField(enumConfigField)}
          {getField(multiSelectField)}
        </>
      )}
      {isEntityRef && getField(entityReferenceConfigField)}
      <DescriptionFormField
        editorKey={editorKey}
        form={form}
        initialValue={property.description ?? ''}
      />
    </HookForm>
  );
};

export default CustomPropertyEditForm;
