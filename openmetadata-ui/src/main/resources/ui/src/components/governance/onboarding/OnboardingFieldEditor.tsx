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
  FormField,
  HookForm,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { ReactNode, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { CustomProperty } from '../../../generated/entity/type';
import {
  FieldKind,
  IntakeFormField,
} from '../../../generated/governance/intakeForm';
import { serializeExtensionValue } from '../../../utils/CustomProperty.utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DomainFormValues } from '../../Domain/AddDomainForm/AddDomainForm.interface';
import AddDomainFormExtensionFields from '../../Domain/AddDomainForm/AddDomainFormExtensionFields';
import {
  getExtensionFormKey,
  getExtensionPropertyName,
} from '../../Domain/AddDomainForm/AddDomainFormExtensionFields.utils';
import { OnboardingNativeInput } from './OnboardingNativeInput';

interface Props {
  field: IntakeFormField;
  value: unknown;
  properties: CustomProperty[];
  onSave: (value: unknown) => Promise<void>;
  onCancel?: () => void;
  children?: ReactNode;
  submitLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
  isDisabled?: boolean;
  permissions?: OperationPermission;
}
const NativeEditor = ({
  field,
  value,
  onSave,
  onCancel,
  children,
  submitLabel,
  onDirtyChange,
  isDisabled,
  permissions,
}: Props) => {
  const form = useForm<{ value: unknown }>({ defaultValues: { value } });
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);

    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty]);

  return (
    <HookForm
      form={form}
      onSubmit={form.handleSubmit(async (values) => {
        setSaving(true);
        try {
          await onSave(
            field.fieldPath === 'synonyms' && typeof values.value === 'string'
              ? values.value
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean)
              : values.value
          );
          form.reset(values);
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setSaving(false);
        }
      })}>
      <fieldset
        aria-busy={saving}
        className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0"
        disabled={saving}
        ref={(node) => {
          if (node) {
            node.inert = saving;
          }
        }}>
        <FormField control={form.control} name="value">
          {({ field: input }) => (
            <OnboardingNativeInput
              label={field.fieldLabel}
              path={field.fieldPath}
              permissions={permissions}
              value={input.value}
              onChange={input.onChange}
            />
          )}
        </FormField>
      </fieldset>
      <Box className="tw:mt-4 tw:justify-end tw:gap-2" wrap="wrap">
        {children}
        {onCancel && (
          <Button color="tertiary" onPress={onCancel}>
            {t('label.cancel')}
          </Button>
        )}
        <Button isDisabled={isDisabled} isLoading={saving} type="submit">
          {submitLabel ?? t('label.save')}
        </Button>
      </Box>
    </HookForm>
  );
};
const CustomEditor = ({
  field,
  value,
  properties,
  onSave,
  onCancel,
  children,
  submitLabel,
  onDirtyChange,
  isDisabled,
}: Props) => {
  const propertyName = getExtensionPropertyName(field.fieldPath);
  const key = getExtensionFormKey(propertyName);
  const form = useForm<DomainFormValues>({
    defaultValues: { extensionFormValues: { [key]: value } },
  });
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);

    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty]);
  const definition = properties.find(
    (property) => property.name === propertyName
  );

  return (
    <HookForm
      form={form}
      onSubmit={form.handleSubmit(async (values) => {
        if (!definition) {
          return;
        }
        setSaving(true);
        try {
          await onSave(
            serializeExtensionValue(
              definition,
              values.extensionFormValues?.[key]
            )
          );
          form.reset(values);
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setSaving(false);
        }
      })}>
      <fieldset
        aria-busy={saving}
        className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0"
        disabled={saving}
        ref={(node) => {
          if (node) {
            node.inert = saving;
          }
        }}>
        <AddDomainFormExtensionFields
          control={form.control}
          customProperties={properties}
          formFields={[{ ...field, required: false }]}
        />
      </fieldset>
      <Box className="tw:mt-4 tw:justify-end tw:gap-2" wrap="wrap">
        {children}
        {onCancel && (
          <Button color="tertiary" onPress={onCancel}>
            {t('label.cancel')}
          </Button>
        )}
        <Button
          isDisabled={isDisabled || !definition}
          isLoading={saving}
          type="submit">
          {submitLabel ?? t('label.save')}
        </Button>
      </Box>
    </HookForm>
  );
};

export const OnboardingFieldEditor = (props: Props) =>
  props.field.fieldKind === FieldKind.CustomProperty ? (
    <CustomEditor {...props} />
  ) : (
    <NativeEditor {...props} />
  );
