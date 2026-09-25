/*
 *  Copyright 2023 Collate.
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
  FormSelectItem,
  getField,
  HelperTextType,
  HintText,
  HookForm,
} from '@openmetadata/ui-core-components';
import { Delete, Plus } from '@openmetadata/ui-core-components/icons';
import { useCallback, useMemo } from 'react';
import { Control, useFieldArray, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { validateReferenceURL } from '../../../utils/GlossaryPureUtils';
import GlossaryTermPicker from '../../common/GlossaryTermPicker/GlossaryTermPicker';
import {
  AVAILABLE_ICONS,
  DEFAULT_GLOSSARY_TERM_ICON,
} from '../../common/IconPicker/IconPicker.constants';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { DomainFormValues } from '../../Domain/AddDomainForm/AddDomainForm.interface';
import AddDomainFormExtensionFields from '../../Domain/AddDomainForm/AddDomainFormExtensionFields';
import TagSelector from '../../Tag/TagSelector/TagSelector';
import { useEntityReferenceOptions } from '../hooks/useEntityReferenceOptions';
import { useGlossaryFormFields } from '../hooks/useGlossaryFormFields';
import { AddGlossaryTermFormProps } from './AddGlossaryTermForm.interface';
import { getGlossaryTermFqn } from './AddGlossaryTermForm.utils';

const ICON_OPTIONS: FormSelectItem[] = [
  DEFAULT_GLOSSARY_TERM_ICON,
  ...AVAILABLE_ICONS.filter(
    (icon) => icon.name !== DEFAULT_GLOSSARY_TERM_ICON.name
  ),
].map((icon) => ({ icon: icon.component, id: icon.name, label: icon.name }));

const AddGlossaryTermForm = ({
  editMode,
  form,
  glossaryTerm,
  intake,
  onSubmit,
}: AddGlossaryTermFormProps) => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.GLOSSARY_TERM);
  const { userTeamOptions, onUserTeamFocus, onUserTeamSearch } =
    useEntityReferenceOptions();
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
  const {
    fields: references,
    append: addReference,
    remove: removeReference,
  } = useFieldArray({ control: form.control, name: 'references' });

  const [selectedColor, isMutuallyExclusive] = useWatch({
    control: form.control,
    name: ['color', 'mutuallyExclusive'],
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

  // The intake form can make any native field mandatory; its configured
  // message wins over the generic one.
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

  const synonymsField: FieldProp = {
    id: 'root/synonyms',
    label: t('label.synonym-plural'),
    name: 'synonyms',
    placeholder: t('message.synonym-placeholder'),
    props: {
      'data-testid': 'synonyms',
      allowsCreation: true,
      hideDropdown: true,
      items: [],
    },
    type: FieldTypes.MULTI_SELECT,
  };

  const iconField: FieldProp = {
    id: 'root/iconURL',
    label: t('label.icon'),
    name: 'iconURL',
    helperText: t('message.icon-aspect-ratio'),
    helperTextType: HelperTextType.TOOLTIP,
    placeholder: t('label.icon-url'),
    props: {
      allowUrl: true,
      backgroundColor: selectedColor,
      'data-testid': 'icon-picker-btn',
      defaultIcon: DEFAULT_GLOSSARY_TERM_ICON,
      labels: {
        customIconUrl: t('label.icon-url'),
        emptyState: t('label.no-entity-available', {
          entity: t('label.icon-plural'),
        }),
        enterIconUrl: t('label.enter-entity', {
          entity: t('label.icon-url'),
        }),
        iconsTab: t('label.icon-plural'),
        urlTab: t('label.url'),
      },
      options: ICON_OPTIONS,
    },
    type: FieldTypes.ICON_PICKER,
  };

  const colorField: FieldProp = {
    id: 'root/color',
    label: t('label.color'),
    name: 'color',
    props: { 'data-testid': 'color-picker' },
    type: FieldTypes.COLOR_PICKER,
  };

  const descriptionMessage =
    getIntakeRequiredMessage('description') ??
    t('label.field-required', { field: t('label.description') });
  const tagsRequiredMessage = getIntakeRequiredMessage('tags');
  const relatedTermsRequiredMessage = getIntakeRequiredMessage('relatedTerms');

  const excludedRelatedTermFqns = useMemo(
    () => [getGlossaryTermFqn(glossaryTerm)],
    [glossaryTerm]
  );

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-6 tw:**:data-[testid=form-item-label]:font-medium"
      data-testid="add-glossary-term-form"
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}>
      <Box align="start" gap={4}>
        <div className="tw:min-w-[40px] tw:basis-[10%] tw:flex-[0_0_10%]">
          {getField(applyIntakeRequired(iconField))}
        </div>
        <div className="tw:min-w-0 tw:basis-[90%] tw:flex-[0_0_90%]">
          {getField(applyIntakeRequired(colorField))}
        </div>
      </Box>

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
          required: descriptionMessage,
          validate: (value: string) =>
            value?.trim() ? true : descriptionMessage,
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

      <FormField
        control={form.control}
        name="tags"
        rules={tagsRequiredMessage ? { required: tagsRequiredMessage } : {}}>
        {({ field, fieldState }) => (
          <Box
            aria-invalid={fieldState.invalid || undefined}
            className="tw:gap-1.5"
            direction="col">
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

      {getField(applyIntakeRequired(synonymsField))}

      <FormField
        control={form.control}
        name="relatedTerms"
        rules={
          relatedTermsRequiredMessage
            ? { required: relatedTermsRequiredMessage }
            : {}
        }>
        {({ field, fieldState }) => (
          <Box
            aria-invalid={fieldState.invalid || undefined}
            className="tw:gap-1.5"
            direction="col">
            <GlossaryTermPicker
              data-testid="related-terms"
              // A term cannot be related to itself.
              excludeFqns={excludedRelatedTermFqns}
              label={t('label.related-term-plural')}
              placeholder={t('label.add-entity', {
                entity: t('label.related-term-plural'),
              })}
              required={Boolean(relatedTermsRequiredMessage)}
              value={field.value}
              // The nodes carry the term entity, whose id an edit needs.
              onChange={(_terms, nodes) => field.onChange(nodes)}
            />
            {fieldState.error?.message && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>

      {getField(
        applyIntakeRequired(
          getMutuallyExclusiveField(
            Boolean(isMutuallyExclusive),
            t('label.glossary-term')
          )
        )
      )}

      <Box className="tw:gap-3" data-testid="references" direction="col">
        <Box align="center" justify="between">
          <FormItemLabel label={t('label.reference-plural')} />
          <Button
            color="secondary"
            data-testid="add-reference"
            iconLeading={Plus}
            size="sm"
            onPress={() => addReference({ name: '', endpoint: '' })}>
            {t('label.add')}
          </Button>
        </Box>
        {references.map((reference, index) => (
          <Box align="start" gap={2} key={reference.id}>
            <div className="tw:min-w-0 tw:flex-1">
              {getField({
                id: `name-${index}`,
                label: t('label.name'),
                name: `references.${index}.name`,
                placeholder: t('label.name'),
                required: true,
                rules: {
                  required: t('message.field-text-is-required', {
                    fieldText: t('label.name'),
                  }),
                },
                type: FieldTypes.TEXT,
              })}
            </div>
            <div className="tw:min-w-0 tw:flex-1">
              {getField({
                id: `url-${index}`,
                label: t('label.endpoint'),
                name: `references.${index}.endpoint`,
                placeholder: t('label.endpoint'),
                required: true,
                rules: {
                  required: t('message.valid-url-endpoint'),
                  validate: (value: string) =>
                    validateReferenceURL(value) ||
                    t('message.url-must-start-with-http-or-https'),
                },
                type: FieldTypes.TEXT,
              })}
            </div>
            <Button
              aria-label={t('label.remove')}
              className="tw:mt-6"
              color="tertiary"
              data-testid={`remove-reference-${index}`}
              iconLeading={Delete}
              size="sm"
              onPress={() => removeReference(index)}
            />
          </Box>
        ))}
      </Box>

      {getField(applyIntakeRequired(ownersField))}
      {getField(applyIntakeRequired(reviewersField))}

      {!editMode && intake.isLoaded && (
        <AddDomainFormExtensionFields
          // The extension fields only read and write `extensionFormValues.*`,
          // which both form shapes share.
          control={form.control as unknown as Control<DomainFormValues>}
          customProperties={intake.customProperties}
          formFields={intake.extensionFormFields}
        />
      )}
    </HookForm>
  );
};

export default AddGlossaryTermForm;
