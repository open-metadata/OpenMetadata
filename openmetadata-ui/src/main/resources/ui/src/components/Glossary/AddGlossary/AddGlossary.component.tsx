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
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { useEntityRules } from '../../../hooks/useEntityRules';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import TagSelector from '../../Tag/TagSelector/TagSelector';
import { useEntityReferenceOptions } from '../hooks/useEntityReferenceOptions';
import { useGlossaryFormFields } from '../hooks/useGlossaryFormFields';
import { AddGlossaryProps } from './AddGlossary.interface';

const AddGlossary = ({ form, onSubmit }: AddGlossaryProps) => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.GLOSSARY);
  const {
    domainOptions,
    userTeamOptions,
    onDomainFocus,
    onDomainSearch,
    onUserTeamFocus,
    onUserTeamSearch,
  } = useEntityReferenceOptions();
  const {
    nameField,
    displayNameField,
    getMutuallyExclusiveField,
    ownersField,
    reviewersField,
  } = useGlossaryFormFields({
    entityRules,
    userTeamOptions,
    onUserTeamFocus,
    onUserTeamSearch,
  });

  const isMutuallyExclusive = useWatch({
    control: form.control,
    name: 'mutuallyExclusive',
  });

  const domainsField: FieldProp = {
    id: 'root/domains',
    label: t('label.domain-plural'),
    name: 'domains',
    placeholder: t('label.select-field', { field: t('label.domain-plural') }),
    props: {
      'data-testid': 'domains',
      filterOption: () => true,
      multiple: true,
      onFocus: onDomainFocus,
      onSearchChange: onDomainSearch,
      options: domainOptions,
    },
    rules: {
      validate: (value: unknown[] = []) =>
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
          {getField(nameField)}
        </div>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(displayNameField)}
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
              // Seeded from the defaults, not the live value, so typing never
              // re-applies content to the editor; `reset` re-seeds it.
              initialValue={form.formState.defaultValues?.description}
              onTextChange={field.onChange}
            />
            {fieldState.error?.message && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>

      <FormField control={form.control} name="tags">
        {({ field }) => (
          <TagSelector
            className="tw:w-full"
            data-testid="tags-container"
            label={t('label.tag-plural')}
            placeholder={t('label.select-field', {
              field: t('label.tag-plural'),
            })}
            value={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      </FormField>

      {getField(
        getMutuallyExclusiveField(
          Boolean(isMutuallyExclusive),
          t('label.glossary')
        )
      )}
      {getField(ownersField)}
      {getField(reviewersField)}
      {getField(domainsField)}
    </HookForm>
  );
};

export default AddGlossary;
