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
import { Box, FormField, HookForm } from '@openmetadata/ui-core-components';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../generated/entity/type';
import {
  FieldKind,
  IntakeFormField,
} from '../../../generated/governance/intakeForm';
import {
  hasValue,
  isRecord,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import { getExtensionFormKey } from '../../Domain/AddDomainForm/AddDomainFormExtensionFields.utils';
import GlossaryTermIntakeFields, {
  GlossaryTermIntakeFieldsHandle,
} from '../../Glossary/AddGlossaryTermForm/GlossaryTermIntakeFields.component';
import { OnboardingNativeInput } from './OnboardingNativeInput';

export interface OnboardingSupplementalHandle {
  validate: () => Promise<boolean>;
  getValues: () => Record<string, unknown>;
}
interface Props {
  fields: IntakeFormField[];
  properties: CustomProperty[];
  onValuesChange?: (values: Record<string, unknown>) => void;
}

export const OnboardingSupplementalFields = forwardRef<
  OnboardingSupplementalHandle,
  Props
>(({ fields, properties, onValuesChange }, ref) => {
  const { t } = useTranslation();
  const form = useForm<{ values: Record<string, unknown> }>({
    defaultValues: { values: {} },
  });
  const custom = useRef<GlossaryTermIntakeFieldsHandle>(null);
  const [extension, setExtension] = useState<Record<string, unknown>>({});
  const watched = useWatch({ control: form.control, name: 'values' });
  const draft: Record<string, unknown> = { extension };
  fields
    .filter((field) => field.fieldKind === FieldKind.Native)
    .forEach((field) => {
      const parts = field.fieldPath.split('.');
      const value = watched[getExtensionFormKey(field.fieldPath)];
      if (parts.length === 1) {
        draft[parts[0]] = value;
      } else {
        const nested = draft[parts[0]];
        draft[parts[0]] = {
          ...(isRecord(nested) ? nested : {}),
          [parts[1]]: value,
        };
      }
    });
  const serialized = JSON.stringify(draft);
  useEffect(() => {
    onValuesChange?.(JSON.parse(serialized));
  }, [onValuesChange, serialized]);
  useImperativeHandle(
    ref,
    () => ({
      validate: async () =>
        (await form.trigger()) && (await (custom.current?.validate() ?? true)),
      getValues: () => {
        const values: Record<string, unknown> = {
          extension: custom.current?.getExtension() ?? {},
        };
        for (const field of fields.filter(
          (item) => item.fieldKind === FieldKind.Native
        )) {
          const value = form.getValues(
            `values.${getExtensionFormKey(field.fieldPath)}`
          );
          values[field.fieldPath] =
            field.fieldPath === 'domains' && Array.isArray(value)
              ? value
                  .filter(isRecord)
                  .map((domain) => domain.fullyQualifiedName ?? domain.name)
              : value;
        }

        return values;
      },
    }),
    [fields, form]
  );

  return (
    <Box className="tw:gap-4" direction="col">
      <HookForm form={form} onSubmit={(event) => event.preventDefault()}>
        {fields
          .filter((field) => field.fieldKind === FieldKind.Native)
          .map((field) => (
            <FormField
              control={form.control}
              key={field.fieldPath}
              name={`values.${getExtensionFormKey(field.fieldPath)}`}
              rules={{
                validate: (value) =>
                  !field.required ||
                  hasValue(value) ||
                  field.errorMessage ||
                  t('label.field-required', { field: field.fieldLabel }),
              }}>
              {({ field: input, fieldState }) => (
                <Box className="tw:mb-4 tw:gap-1" direction="col">
                  <OnboardingNativeInput
                    label={field.fieldLabel}
                    path={field.fieldPath}
                    value={input.value}
                    onChange={input.onChange}
                  />
                  {fieldState.error && (
                    <span
                      className="tw:text-sm tw:text-error-primary"
                      role="alert">
                      {fieldState.error.message}
                    </span>
                  )}
                </Box>
              )}
            </FormField>
          ))}
      </HookForm>
      <GlossaryTermIntakeFields
        customProperties={properties}
        formFields={fields.filter(
          (field) => field.fieldKind === FieldKind.CustomProperty
        )}
        ref={custom}
        onValuesChange={setExtension}
      />
    </Box>
  );
});
OnboardingSupplementalFields.displayName = 'OnboardingSupplementalFields';
