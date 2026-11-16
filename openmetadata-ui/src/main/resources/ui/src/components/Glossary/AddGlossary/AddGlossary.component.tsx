/*
 *  Copyright 2022 Collate.
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
} from '@openmetadata/ui-core-components';
import { useCallback } from 'react';
import { Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { useEntityRules } from '../../../hooks/useEntityRules';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { DomainFormValues } from '../../Domain/AddDomainForm/AddDomainForm.interface';
import AddDomainFormExtensionFields from '../../Domain/AddDomainForm/AddDomainFormExtensionFields';
import TagSelector from '../../Tag/TagSelector/TagSelector';
import {
  useDomainOptions,
  useUserTeamOptions,
} from '../hooks/useEntityReferenceOptions';
import { useGlossaryFormFields } from '../hooks/useGlossaryFormFields';
import {
  AddGlossaryProps,
  EntityReferenceOption,
} from './AddGlossary.interface';

const AddGlossary = ({ form, intake, onSubmit }: AddGlossaryProps) => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.GLOSSARY);
  const ownersPicker = useUserTeamOptions();
  const reviewersPicker = useUserTeamOptions();
  const domainsPicker = useDomainOptions();
  const {
    nameField,
    displayNameField,
    getMutuallyExclusiveField,
    ownersField,
    reviewersField,
  } = useGlossaryFormFields({
    entityRules,
    ownersPicker,
    reviewersPicker,
  });

  const isMutuallyExclusive = useWatch({
    control: form.control,
    name: 'mutuallyExclusive',
  });

  const getIntakeRequiredMessage = useCallback(
    (fieldPath: string): string | undefined => {
      const intakeField = intake.requiredNativeFields.get(fieldPath);

      return intakeField
        ? intakeField.errorMessage ||
            t('label.field-required', { field: intakeField.fieldLabel })
        : undefined;
    },
    [intake.requiredNativeFields, t]
  );

  // Intake forms can make any native field required, with their own message.
  const applyIntakeRequired = useCallback(
    (field: FieldProp): FieldProp => {
      const message = getIntakeRequiredMessage(field.name);

      return message
        ? {
            ...field,
            required: true,
            rules: { ...field.rules, required: message },
          }
        : field;
    },
    [getIntakeRequiredMessage]
  );

  const tagsRequiredMessage = getIntakeRequiredMessage('tags');

  const domainsField: FieldProp = {
    id: 'root/domains',
    label: t('label.domain-plural'),
    name: 'domains',
    placeholder: t('label.select-field', { field: t('label.domain-plural') }),
    props: {
      'data-testid': 'domains',
      filterOption: () => true,
      multiple: true,
      onFocus: domainsPicker.onFocus,
      onSearchChange: domainsPicker.onSearchChange,
      options: domainsPicker.options,
    },
    rules: {
      validate: (value: EntityReferenceOption[] = []) =>
        entityRules.canAddMultipleDomains || value.length <= 1
          ? true
          : t('message.select-at-most-one-entity', {
              entity: t('label.domain'),
            }),
    },
    type: FieldTypes.DOMAIN_SELECT,
  };

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-6 tw:**:data-[testid=form-item-label]:font-medium"
      data-testid="add-glossary-form"
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}>
      <Box gap={4}>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(applyIntakeRequired(nameField))}
        </div>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(applyIntakeRequired(displayNameField))}
        </div>
      </Box>

      <FormField
        control={form.control}
        name="description"
        rules={{
          required: t('label.field-required', {
            field: t('label.description'),
          }),
          validate: (value: string) =>
            value?.trim()
              ? true
              : t('label.field-required', { field: t('label.description') }),
        }}>
        {({ field, fieldState }) => (
          <Box
            aria-invalid={fieldState.invalid || undefined}
            className="tw:gap-1.5"
            data-testid="description"
            direction="col">
            <FormItemLabel required label={t('label.description')} />
            <RichTextEditor
              className="new-form-style"
              // Seeded from defaults so typing never resets the editor.
              initialValue={form.formState.defaultValues?.description}
              onTextChange={field.onChange}
            />
            {fieldState.error?.message && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>

      <FormField
        control={form.control}
        name="tags"
        rules={tagsRequiredMessage ? { required: tagsRequiredMessage } : {}}>
        {({ field, fieldState }) => (
          <Box
            aria-invalid={fieldState.invalid || undefined}
            direction="col"
            gap={2}>
            <TagSelector
              className="tw:w-full"
              data-testid="tags-container"
              label={t('label.tag-plural')}
              placeholder={t('label.select-field', {
                field: t('label.tag-plural'),
              })}
              required={Boolean(tagsRequiredMessage)}
              value={field.value ?? []}
              onChange={field.onChange}
            />
            {fieldState.error?.message && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>

      {getField(applyIntakeRequired(ownersField))}
      {getField(applyIntakeRequired(reviewersField))}
      {getField(applyIntakeRequired(domainsField))}
      {getField(
        getMutuallyExclusiveField(
          Boolean(isMutuallyExclusive),
          t('label.glossary')
        )
      )}

      {intake.isLoaded && (
        <AddDomainFormExtensionFields
          // Safe cast: these fields only touch `extensionFormValues`, shared by both forms.
          control={form.control as unknown as Control<DomainFormValues>}
          customProperties={intake.customProperties}
          formFields={intake.extensionFormFields}
        />
      )}
    </HookForm>
  );
};

export default AddGlossary;
