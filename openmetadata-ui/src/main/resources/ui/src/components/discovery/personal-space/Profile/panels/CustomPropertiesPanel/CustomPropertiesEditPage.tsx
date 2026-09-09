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
  Button,
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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { uniq } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ENTITY_REFERENCE_OPTIONS,
  PROPERTY_TYPES_WITH_ENTITY_REFERENCE,
} from '../../../../../../constants/CustomProperty.constants';
import { Type } from '../../../../../../generated/entity/type';
import {
  Config,
  CustomProperty,
} from '../../../../../../generated/type/customProperty';
import {
  getTypeByFQN,
  updateType,
} from '../../../../../../rest/metadataTypeAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';

/** FieldTypes.SELECT / MULTI_SELECT from core-components stores FormSelectItem objects, not raw strings. */
interface FormSelectItem {
  id: string;
  label?: string;
}

/** Extract the id string from a FormSelectItem (or return as-is if already a string). */
const toId = (v: FormSelectItem | string | undefined): string => {
  if (!v) {
    return '';
  }

  return typeof v === 'string' ? v : v.id;
};

interface EditCustomPropertyFormValues {
  displayName?: string;
  description: string;
  enumConfig?: FormSelectItem[];
  multiSelect?: boolean;
  entityReferenceConfig?: FormSelectItem[];
}

interface DescriptionFormFieldProps {
  form: UseFormReturn<EditCustomPropertyFormValues>;
  descriptionKey: number;
  initialValue: string;
}

const DescriptionFormField: React.FC<DescriptionFormFieldProps> = ({
  form,
  descriptionKey,
  initialValue,
}) => {
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

interface CustomPropertiesEditPageProps {
  entityType: Type;
  property: CustomProperty;
  showHint?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

const CustomPropertiesEditPage: React.FC<CustomPropertiesEditPageProps> = ({
  entityType,
  property,
  showHint = false,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [typeDetail, setTypeDetail] = useState<Type | undefined>();

  const propertyTypeName = property.propertyType.name ?? '';
  const isEnum = propertyTypeName === 'enum';
  const isEntityRef =
    PROPERTY_TYPES_WITH_ENTITY_REFERENCE.includes(propertyTypeName);

  const existingEnumValues = useMemo(() => {
    if (!isEnum) {
      return [];
    }
    const cfg = property.customPropertyConfig?.config;
    if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
      return (cfg as Config).values ?? [];
    }

    return [];
  }, [isEnum, property.customPropertyConfig]);

  const existingMultiSelect = useMemo(() => {
    if (!isEnum) {
      return false;
    }
    const cfg = property.customPropertyConfig?.config;
    if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
      return Boolean((cfg as Config).multiSelect);
    }

    return false;
  }, [isEnum, property.customPropertyConfig]);

  const existingEntityRefs = useMemo(() => {
    if (!isEntityRef) {
      return [];
    }
    const cfg = property.customPropertyConfig?.config;
    if (Array.isArray(cfg)) {
      return cfg as string[];
    }

    return [];
  }, [isEntityRef, property.customPropertyConfig]);

  const form = useForm<EditCustomPropertyFormValues>({
    defaultValues: {
      displayName: property.displayName ?? '',
      description: property.description ?? '',
      enumConfig: existingEnumValues.map((v) => ({ id: v, label: v })),
      multiSelect: existingMultiSelect,
      entityReferenceConfig: existingEntityRefs.map((v) => ({
        id: v,
        label: v,
      })),
    },
  });

  const [descriptionKey, setDescriptionKey] = useState(0);
  useEffect(() => {
    form.reset({
      displayName: property.displayName ?? '',
      description: property.description ?? '',
      enumConfig: existingEnumValues.map((v) => ({ id: v, label: v })),
      multiSelect: existingMultiSelect,
      entityReferenceConfig: existingEntityRefs.map((v) => ({
        id: v,
        label: v,
      })),
    });
    setDescriptionKey((k) => k + 1);
  }, [
    property,
    existingEnumValues,
    existingMultiSelect,
    existingEntityRefs,
    form,
  ]);

  const fetchTypeDetail = useCallback(async () => {
    if (!entityType.fullyQualifiedName) {
      return;
    }
    try {
      const detail = await getTypeByFQN(entityType.fullyQualifiedName);
      setTypeDetail(detail);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [entityType.fullyQualifiedName]);

  useEffect(() => {
    fetchTypeDetail();
  }, [fetchTypeDetail]);

  const displayNameField: FieldProp = useMemo(
    () => ({
      name: 'displayName',
      label: t('label.display-name'),
      type: FieldTypes.TEXT,
      required: false,
      placeholder: t('label.display-name'),
      doc: t('message.custom-property-display-name-help'),
      props: { 'data-testid': 'edit-custom-property-display-name' },
    }),
    [t]
  );

  const enumConfigField: FieldProp = useMemo(
    () => ({
      name: 'enumConfig',
      label: t('label.enum-value-plural'),
      type: FieldTypes.MULTI_SELECT,
      required: false,
      placeholder: t('label.enum-value-plural'),
      doc: t('message.custom-property-enum-config-help'),
      props: {
        'data-testid': 'edit-custom-property-enum-config',
        allowsCreation: true,
        items: existingEnumValues.map((v) => ({ id: v, label: v })),
      },
    }),
    [t, existingEnumValues]
  );

  const multiSelectField: FieldProp = useMemo(
    () => ({
      name: 'multiSelect',
      label: t('label.multi-select'),
      type: FieldTypes.SWITCH,
      required: false,
      doc: t('message.custom-property-multi-select-help'),
      props: { 'data-testid': 'edit-custom-property-multi-select' },
    }),
    [t]
  );

  const entityReferenceConfigField: FieldProp = useMemo(
    () => ({
      name: 'entityReferenceConfig',
      label: t('label.entity-reference-types'),
      type: FieldTypes.MULTI_SELECT,
      required: false,
      placeholder: t('label.select-field', { field: t('label.type') }),
      doc: t('message.custom-property-entity-reference-config-help'),
      props: {
        'data-testid': 'edit-custom-property-entity-ref-config',
        items: ENTITY_REFERENCE_OPTIONS.map((opt) => ({
          id: opt.value,
          label: opt.label,
        })),
      },
    }),
    [t]
  );

  const handleSubmit = useCallback(
    async (data: EditCustomPropertyFormValues) => {
      if (!typeDetail) {
        return;
      }

      let customPropertyConfig = property.customPropertyConfig;

      if (isEnum && data.enumConfig) {
        const newValues = data.enumConfig.map(toId);
        customPropertyConfig = {
          config: {
            multiSelect: Boolean(data.multiSelect),
            values: uniq(newValues),
          },
        };
      } else if (isEntityRef && data.entityReferenceConfig) {
        customPropertyConfig = {
          config: data.entityReferenceConfig.map(toId),
        };
      }

      const updatedProperty: CustomProperty = {
        ...property,
        displayName: data.displayName,
        description: data.description,
        customPropertyConfig,
      };

      const updatedProperties = (typeDetail.customProperties ?? []).map(
        (prop) => (prop.name === property.name ? updatedProperty : prop)
      );

      const patch = compare(
        { ...typeDetail },
        { ...typeDetail, customProperties: updatedProperties }
      );

      setIsSaving(true);
      try {
        await updateType(typeDetail.id ?? '', patch);
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.custom-property'),
          })
        );
        onSuccess();
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [isEnum, isEntityRef, onSuccess, property, t, typeDetail]
  );

  return (
    <Box
      className="tw:flex tw:h-full tw:flex-col tw:overflow-hidden"
      data-testid="custom-properties-edit-page"
      direction="col">
      <div className="tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0">
        <Box className="tw:max-w-[50%]" direction="col">
          <HookForm
            className="tw:flex tw:flex-col tw:gap-6"
            data-testid="edit-custom-property-form"
            fieldDocDisplay="popover"
            form={form}
            id="edit-custom-property-form"
            renderFieldDoc={(text) => (
              <Typography className="tw:text-tertiary" size="text-sm">
                {text}
              </Typography>
            )}
            showFieldDocs={showHint}
            onSubmit={form.handleSubmit(handleSubmit)}>
            {getField(displayNameField)}

            {isEnum && (
              <>
                {getField(enumConfigField)}
                {getField(multiSelectField)}
              </>
            )}
            {isEntityRef && getField(entityReferenceConfigField)}

            <DescriptionFormField
              descriptionKey={descriptionKey}
              form={form}
              initialValue={property.description ?? ''}
            />
          </HookForm>
        </Box>
      </div>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-background-base tw:px-8 tw:py-4 tw:shadow-sm"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="edit-custom-property-cancel"
          isDisabled={isSaving}
          type="button"
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="edit-custom-property-save"
          form="edit-custom-property-form"
          isLoading={isSaving}
          type="submit">
          {t('label.save-entity', { entity: t('label.change-plural') })}
        </Button>
      </Box>
    </Box>
  );
};

export default CustomPropertiesEditPage;
