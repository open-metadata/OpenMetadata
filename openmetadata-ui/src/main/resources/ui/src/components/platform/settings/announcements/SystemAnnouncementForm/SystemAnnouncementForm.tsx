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
  Input,
  Label,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AnnouncementType } from '../../../../../generated/entity/feed/announcement';
import { useSaveSystemAnnouncement } from '../../../../../hooks/platform/useSystemAnnouncements';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { CUSTOM_TYPE_NAME_MAX_LENGTH } from '../../../../../utils/AnnouncementsUtils';
import { isDescriptionContentEmpty } from '../../../../../utils/BlockEditorPureUtils';
import RichTextEditor from '../../../../common/RichTextEditor/RichTextEditor';
import {
  AnnouncementDateField,
  AnnouncementFieldError,
} from '../../../../Modals/AnnouncementModal/AnnouncementDateField';
import {
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MIN_LENGTH,
  toAnnouncementTypeFields,
} from '../../../../Modals/AnnouncementModal/announcementFormUtils';
import { AnnouncementFormValues } from '../../../../Modals/AnnouncementModal/AnnouncementModal.interface';
import {
  AnnouncementColorSelect,
  AnnouncementTypeSelect,
} from '../../../../Modals/AnnouncementModal/AnnouncementTypeField.component';
import AnnouncementBannerPreview from '../AnnouncementBannerPreview/AnnouncementBannerPreview';
import { SystemAnnouncementFormProps } from './SystemAnnouncementForm.types';
import { getSystemAnnouncementDefaultValues } from './SystemAnnouncementForm.utils';

const FORM_ID = 'system-announcement-form';

/**
 * Add, edit or duplicate a system announcement — one with no entity link, shown
 * to the whole organization. Type, title, window and a rich-text description,
 * with a live preview of the banner beside them. It navigates nowhere itself:
 * the surface that mounts it says where Cancel and Save lead.
 */
const SystemAnnouncementForm = ({
  mode,
  announcement,
  onCancel,
  onSaved,
  centered,
}: SystemAnnouncementFormProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const isEdit = mode === 'edit' && Boolean(announcement);

  const form = useForm<AnnouncementFormValues>({
    // `onChange` so `formState.isValid`, which gates submit, tracks the fields
    // as they are filled rather than only after a submit.
    mode: 'onChange',
    defaultValues: getSystemAnnouncementDefaultValues(
      mode,
      (title) => t('label.entity-copy', { entity: title }),
      announcement
    ),
  });
  const values = useWatch({ control: form.control }) as AnnouncementFormValues;
  const isCustom = values.type === AnnouncementType.Custom;
  const saveMutation = useSaveSystemAnnouncement(onSaved);

  const requiredMessage = (fieldText: string) =>
    t('message.field-text-is-required', { fieldText });

  const handleSubmit = (formValues: AnnouncementFormValues) => {
    const { title, description, startTime, endTime } = formValues;

    // The rules gate submit, so both dates are set by now; the guard narrows
    // the form's optional type to the `number` the API takes.
    if (startTime == null || endTime == null) {
      return;
    }

    saveMutation.mutate({
      original: isEdit ? announcement : undefined,
      request: {
        displayName: title.trim(),
        description,
        startTime,
        endTime,
        ...toAnnouncementTypeFields(formValues),
      },
    });
  };

  const handleTypeChange = (
    value: AnnouncementType,
    onChange: (value: AnnouncementType) => void
  ) => {
    onChange(value);
    // Leaving Custom drops its colour and name requirements, so their errors go too.
    if (value !== AnnouncementType.Custom) {
      form.clearErrors(['color', 'customTypeName']);
    }
  };

  return (
    <Box className="tw:h-full tw:min-h-0" direction="col">
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto">
        <Box
          className={classNames('tw:w-full tw:max-w-[50%] tw:px-6 tw:pb-6', {
            'tw:mx-auto': centered,
          })}
          direction="col"
          gap={6}>
          <HookForm
            className="tw:flex tw:min-w-0 tw:flex-col tw:gap-5"
            data-testid={FORM_ID}
            form={form}
            id={FORM_ID}
            onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField control={form.control} name="type">
              {({ field }) => (
                <Box className="tw:gap-1.5" direction="col">
                  <Label isRequired>{t('label.announcement-type')}</Label>
                  <AnnouncementTypeSelect
                    value={field.value}
                    onChange={(value) =>
                      handleTypeChange(value, field.onChange)
                    }
                  />
                </Box>
              )}
            </FormField>

            {isCustom && (
              <Box className="tw:gap-4" wrap="wrap">
                <FormField
                  control={form.control}
                  name="customTypeName"
                  rules={{
                    maxLength: CUSTOM_TYPE_NAME_MAX_LENGTH,
                    // A name of only spaces would be trimmed away on submit,
                    // leaving a bare Custom badge.
                    validate: (value) =>
                      Boolean(value?.trim()) ||
                      requiredMessage(t('label.custom-name')),
                  }}>
                  {({ field, fieldState }) => (
                    <Input
                      isRequired
                      className="tw:min-w-0 tw:flex-1"
                      data-testid="custom-type-name"
                      hint={fieldState.error?.message}
                      id="customTypeName"
                      isInvalid={Boolean(fieldState.error)}
                      label={t('label.custom-name')}
                      maxLength={CUSTOM_TYPE_NAME_MAX_LENGTH}
                      placeholder={t('label.enter-entity-name', {
                        entity: t('label.announcement'),
                      })}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>

                <FormField
                  control={form.control}
                  name="color"
                  rules={{ required: requiredMessage(t('label.color')) }}>
                  {({ field, fieldState }) => (
                    <Box
                      className="tw:min-w-0 tw:flex-1 tw:gap-1.5"
                      direction="col">
                      <Label isRequired>{t('label.color')}</Label>
                      <AnnouncementColorSelect
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <AnnouncementFieldError
                        message={fieldState.error?.message}
                        testId="color-error"
                      />
                    </Box>
                  )}
                </FormField>
              </Box>
            )}

            <FormField
              control={form.control}
              name="title"
              rules={{
                validate: (value) =>
                  Boolean(value.trim()) || requiredMessage(t('label.title')),
                minLength: {
                  value: ANNOUNCEMENT_TITLE_MIN_LENGTH,
                  message: t('message.entity-size-in-between', {
                    entity: t('label.title'),
                    min: ANNOUNCEMENT_TITLE_MIN_LENGTH,
                    max: ANNOUNCEMENT_TITLE_MAX_LENGTH,
                  }),
                },
                maxLength: ANNOUNCEMENT_TITLE_MAX_LENGTH,
              }}>
              {({ field, fieldState }) => (
                <Input
                  isRequired
                  data-testid="title"
                  hint={
                    fieldState.error?.message ??
                    `${field.value.length}/${ANNOUNCEMENT_TITLE_MAX_LENGTH}`
                  }
                  id="title"
                  isInvalid={Boolean(fieldState.error)}
                  label={t('label.title')}
                  maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
                  placeholder={t('message.enter-title-here')}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            </FormField>

            <Box className="tw:gap-4" wrap="wrap">
              <FormField
                control={form.control}
                name="startTime"
                rules={{
                  validate: (value) =>
                    value != null || requiredMessage(t('label.start-date')),
                }}>
                {({ field, fieldState }) => (
                  <AnnouncementDateField
                    error={fieldState.error?.message}
                    id="startTime"
                    label={t('label.start-date')}
                    value={field.value}
                    onChange={(next) => {
                      field.onChange(next);
                      // Moving the start can invalidate an end that was fine
                      // against the old one; only re-judge an end that exists,
                      // or its required rule would fire before it is reached.
                      if (form.getValues('endTime') != null) {
                        form.trigger('endTime');
                      }
                    }}
                  />
                )}
              </FormField>

              <FormField
                control={form.control}
                name="endTime"
                rules={{
                  validate: (value, { startTime }) => {
                    if (value == null) {
                      return requiredMessage(t('label.end-date'));
                    }

                    return (
                      startTime == null ||
                      value > startTime ||
                      t('message.announcement-invalid-start-time')
                    );
                  },
                }}>
                {({ field, fieldState }) => (
                  <AnnouncementDateField
                    boundary="end"
                    error={fieldState.error?.message}
                    id="endTime"
                    label={t('label.end-date')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              </FormField>
            </Box>

            <FormField
              control={form.control}
              name="description"
              rules={{
                // Judged on content: the editor's empty `<p></p>` is not a
                // description, and the server requires one.
                validate: (value) =>
                  !isDescriptionContentEmpty(value) ||
                  requiredMessage(t('label.description')),
              }}>
              {({ field, fieldState }) => (
                <Box className="tw:gap-1.5" direction="col">
                  <Label isRequired>{t('label.description')}</Label>
                  <RichTextEditor
                    className="new-form-style"
                    data-testid="description"
                    initialValue={field.value}
                    placeHolder={t('message.enter-a-description')}
                    onTextChange={field.onChange}
                  />
                  <AnnouncementFieldError
                    message={fieldState.error?.message}
                    testId="description-error"
                  />
                </Box>
              )}
            </FormField>
          </HookForm>

          <AnnouncementBannerPreview
            createdBy={isEdit ? announcement?.createdBy : currentUser?.name}
            values={values}
          />
        </Box>
      </div>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:px-6 tw:py-4"
        gap={3}
        justify="end">
        <Button
          color="secondary"
          data-testid="announcement-cancel"
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="announcement-submit"
          form={FORM_ID}
          isDisabled={!form.formState.isValid}
          isLoading={saveMutation.isPending}
          type="submit">
          {isEdit
            ? t('label.save-changes')
            : t('label.add-entity', { entity: t('label.announcement') })}
        </Button>
      </Box>
    </Box>
  );
};

export default SystemAnnouncementForm;
