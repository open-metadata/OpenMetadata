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
import { isArray, isUndefined, map, omit, omitBy, startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  CUSTOM_PROPERTIES_ICON_MAP,
  ENTITY_REFERENCE_OPTIONS,
  PROPERTY_TYPES_WITH_ENTITY_REFERENCE,
  PROPERTY_TYPES_WITH_FORMAT,
  SUPPORTED_FORMAT_MAP,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../../../../constants/CustomProperty.constants';
import { CUSTOM_PROPERTY_NAME_REGEX } from '../../../../../../constants/regex.constants';
import { Category, Type } from '../../../../../../generated/entity/type';
import { CustomProperty } from '../../../../../../generated/type/customProperty';
import {
  addPropertyToEntity,
  getTypeListByCategory,
} from '../../../../../../rest/metadataTypeAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
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

interface AddCustomPropertyFormValues {
  name: string;
  displayName?: string;
  propertyType: FormSelectItem | null;
  description: string;
  enumConfig?: FormSelectItem[];
  multiSelect?: boolean;
  formatConfig?: FormSelectItem | null;
  entityReferenceConfig?: FormSelectItem[];
  columns?: FormSelectItem[];
}

/** Extract the id string from a FormSelectItem (or return as-is if already a string). */
const toId = (v: FormSelectItem | string | undefined): string => {
  if (!v) {
    return '';
  }

  return typeof v === 'string' ? v : v.id;
};

function buildCustomPropertyConfig(
  data: AddCustomPropertyFormValues,
  hasEnumConfig: boolean,
  hasFormatConfig: boolean,
  hasEntityReferenceConfig: boolean,
  hasTableTypeConfig: boolean
) {
  if (hasEnumConfig) {
    return {
      config: {
        multiSelect: Boolean(data.multiSelect),
        values: (data.enumConfig ?? []).map(toId),
      },
    };
  }
  if (hasFormatConfig && data.formatConfig) {
    return { config: toId(data.formatConfig) };
  }
  if (hasEntityReferenceConfig && data.entityReferenceConfig) {
    return { config: data.entityReferenceConfig.map(toId) };
  }
  if (hasTableTypeConfig && data.columns) {
    return { config: { columns: data.columns.map(toId) } };
  }

  return undefined;
}

interface DescriptionFormFieldProps {
  form: UseFormReturn<AddCustomPropertyFormValues>;
  descriptionKey: number;
}

const DescriptionFormField: React.FC<DescriptionFormFieldProps> = ({
  form,
  descriptionKey,
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
            initialValue=""
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

interface CustomPropertiesAddPageProps {
  entityType: Type;
  showHint?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

const CustomPropertiesAddPage: React.FC<CustomPropertiesAddPageProps> = ({
  entityType,
  showHint = false,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [propertyTypes, setPropertyTypes] = useState<Type[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [descriptionKey, setDescriptionKey] = useState(0);

  const form = useForm<AddCustomPropertyFormValues>({
    defaultValues: {
      name: '',
      displayName: '',
      propertyType: null,
      description: '',
      multiSelect: false,
    },
  });

  const watchedPropertyType = useWatch({
    control: form.control,
    name: 'propertyType',
  });

  const fetchPropertyTypes = useCallback(async () => {
    try {
      const response = await getTypeListByCategory(Category.Field);
      setPropertyTypes(response.data ?? []);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, []);

  useEffect(() => {
    fetchPropertyTypes();
  }, [fetchPropertyTypes]);

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
  } = useMemo(() => {
    // watchedPropertyType is a FormSelectItem object — extract the id to look up the type
    const selectedId = toId(watchedPropertyType ?? undefined);
    const found = propertyTypes.find((tp) => tp.id === selectedId);
    const typeName = found?.name ?? '';

    return {
      hasEnumConfig: typeName === 'enum',
      hasFormatConfig: PROPERTY_TYPES_WITH_FORMAT.includes(typeName),
      hasEntityReferenceConfig:
        PROPERTY_TYPES_WITH_ENTITY_REFERENCE.includes(typeName),
      hasTableTypeConfig: typeName === TABLE_TYPE_CUSTOM_PROPERTY,
      supportedFormats:
        SUPPORTED_FORMAT_MAP[typeName as keyof typeof SUPPORTED_FORMAT_MAP] ??
        [],
    };
  }, [watchedPropertyType, propertyTypes]);

  const nameField: FieldProp = useMemo(
    () => ({
      name: 'name',
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
      label: t('label.format'),
      type: FieldTypes.SELECT,
      required: false,
      placeholder: t('label.format'),
      doc: t('message.custom-property-format-config-help'),
      rules: {
        validate: (value: FormSelectItem | null) => {
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
      label: t('label.column-plural'),
      type: FieldTypes.MULTI_SELECT,
      required: true,
      placeholder: t('label.column-plural'),
      rules: {
        required: t('label.field-required', {
          field: t('label.column-plural'),
        }),
        validate: (value: FormSelectItem[]) => {
          if (isArray(value) && value.length > 3) {
            return t('message.maximum-count-allowed', {
              count: 3,
              label: t('label.column-plural'),
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

  const handleSubmit = useCallback(
    async (data: AddCustomPropertyFormValues) => {
      if (!entityType.id) {
        return;
      }

      const customPropertyConfig = buildCustomPropertyConfig(
        data,
        hasEnumConfig,
        hasFormatConfig,
        hasEntityReferenceConfig,
        hasTableTypeConfig
      );

      const payload = omitBy(
        {
          ...omit(data, [
            'multiSelect',
            'formatConfig',
            'entityReferenceConfig',
            'enumConfig',
            'columns',
          ]),
          propertyType: {
            id: toId(data.propertyType ?? undefined),
            type: 'type',
          },
          ...(isUndefined(customPropertyConfig)
            ? {}
            : { customPropertyConfig }),
        },
        isUndefined
      ) as unknown as CustomProperty;

      setIsSaving(true);
      try {
        await addPropertyToEntity(entityType.id, payload);
        showSuccessToast(
          t('server.create-entity-success', {
            entity: t('label.custom-property'),
          })
        );
        setDescriptionKey((k) => k + 1);
        form.reset();
        onSuccess();
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [
      entityType.id,
      form,
      hasEnumConfig,
      hasEntityReferenceConfig,
      hasFormatConfig,
      hasTableTypeConfig,
      onSuccess,
      t,
    ]
  );

  return (
    <Box
      className="tw:flex tw:h-full tw:flex-col tw:overflow-hidden"
      data-testid="custom-properties-add-page"
      direction="col">
      <div className="tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0">
        <Box className="tw:max-w-[50%]" direction="col">
          <HookForm
            className="tw:flex tw:flex-col tw:gap-6"
            data-testid="custom-property-form"
            fieldDocDisplay="popover"
            form={form}
            id="add-custom-property-form"
            renderFieldDoc={(text) => (
              <Typography className="tw:text-tertiary" size="text-sm">
                {text}
              </Typography>
            )}
            showFieldDocs={showHint}
            onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="tw:flex tw:gap-4">
              <div className="tw:flex-1">{getField(nameField)}</div>
              <div className="tw:flex-1">{getField(displayNameField)}</div>
            </div>
            {getField(propertyTypeField)}

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
          data-testid="custom-property-cancel"
          isDisabled={isSaving}
          type="button"
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="custom-property-save"
          form="add-custom-property-form"
          isLoading={isSaving}
          type="submit">
          {t('label.save-entity', { entity: t('label.change-plural') })}
        </Button>
      </Box>
    </Box>
  );
};

export default CustomPropertiesAddPage;
