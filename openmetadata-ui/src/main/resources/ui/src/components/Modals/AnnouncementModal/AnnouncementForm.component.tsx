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
  DatePicker,
  Dialog,
  FeaturedIcon,
  FormField,
  HintText,
  HookForm,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Announcement02 } from '@openmetadata/ui-core-components/icons';
import { useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import { CUSTOM_TYPE_NAME_MAX_LENGTH } from '../../../utils/AnnouncementsUtils';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorPureUtils';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { millisToDateValue } from '../../observability/DataQuality/Dashboard/calendarDate.utils';
import { fromCalendarValue } from './announcementFormUtils';
import { AnnouncementFormValues } from './AnnouncementModal.interface';
import {
  AnnouncementColorSelect,
  AnnouncementTypeSelect,
} from './AnnouncementTypeField.component';

interface AnnouncementFormProps {
  description: string;
  form: UseFormReturn<AnnouncementFormValues>;
  isSaving?: boolean;
  open: boolean;
  submitLabel: string;
  testId: string;
  title: string;
  onCancel: () => void;
  onSubmit: (values: AnnouncementFormValues) => void;
}

/**
 * The error line under a field that is not an `Input` — an `Input` takes the
 * message as its own `hint`, which also wires `aria-describedby` to it. Core's
 * `HintText` is the same element either way, so the two read alike.
 */
const FieldError = ({
  message,
  testId,
}: {
  message?: string;
  testId: string;
}) =>
  message ? (
    <HintText isInvalid data-testid={testId}>
      {message}
    </HintText>
  ) : null;

/**
 * The design system's `DatePicker`: a button trigger showing the selected day,
 * opening a popover with a calendar, a typable date field and a Today preset.
 * It carries its own calendar icon, so the field only supplies the label.
 *
 * The epoch-millis <-> `DateValue` bridge is the shared one the data-quality
 * date filters already use, so the conversion is not hand-rolled per form.
 * `tsconfig.json` pins the react-aria packages to this app's copy, without
 * which `DateValue` has two type identities and no value typechecks here.
 */
const DateField = ({
  boundary = 'start',
  error,
  id,
  label,
  value,
  onChange,
}: {
  /** `end` anchors the value to 23:59:59.999 so the chosen day is included. */
  boundary?: 'start' | 'end';
  error?: string;
  id: string;
  label: string;
  value?: number | null;
  onChange: (value: number | null) => void;
}) => {
  // What the field held when the popover opened. Core's `DatePicker` commits
  // every day click straight through `onChange`, and its Cancel button only
  // closes the popover — so without restoring this, cancelling out of a
  // mis-click keeps the wrong day and submits it.
  const valueOnOpen = useRef<number | null>(value ?? null);

  return (
    <Box className="tw:min-w-0 tw:flex-1 tw:gap-1.5" direction="col">
      <Label isRequired htmlFor={id}>
        {label}
      </Label>
      <DatePicker
        aria-label={label}
        data-testid={id}
        id={id}
        value={millisToDateValue(value ?? undefined)}
        onCancel={() => onChange(valueOnOpen.current)}
        onChange={(selected) => onChange(fromCalendarValue(selected, boundary))}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            valueOnOpen.current = value ?? null;
          }
        }}
      />
      <FieldError message={error} testId={`${id}-error`} />
    </Box>
  );
};

const TITLE_MIN_LENGTH = 5;
const TITLE_MAX_LENGTH = 124;

/**
 * The add and edit dialogs differ only in their title, submit label and where
 * their initial values come from, so they share one body rather than keeping
 * two copies of the field list in sync.
 */
const AnnouncementForm = ({
  description,
  form,
  isSaving = false,
  open,
  submitLabel,
  testId,
  title,
  onCancel,
  onSubmit,
}: AnnouncementFormProps) => {
  const { t } = useTranslation();
  const isCustom = form.watch('type') === AnnouncementType.Custom;
  const requiredMessage = (fieldText: string) =>
    t('message.field-text-is-required', { fieldText });

  const handleTypeChange = (
    value: AnnouncementType,
    onChange: (value: AnnouncementType) => void
  ) => {
    onChange(value);
    // Leaving Custom drops its colour/name requirements, so their errors go too.
    if (value !== AnnouncementType.Custom) {
      form.clearErrors(['color', 'customTypeName']);
    }
  };

  return (
    // Not dismissable: a stray click on the backdrop would throw away a
    // half-written announcement. Escape and the close button still exit.
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        {/* Named here rather than through Dialog's `title`: that renders a
            bare heading, and this header carries an icon and a subtitle. */}
        <Dialog
          showCloseButton
          aria-label={title}
          data-testid={testId}
          width={600}
          onClose={onCancel}>
          <Dialog.Header className="tw:flex tw:items-start tw:gap-3 tw:border-b tw:border-subtle tw:pr-12 tw:pb-5">
            <FeaturedIcon
              color="gray"
              icon={Announcement02}
              size="md"
              theme="modern"
            />
            <Box className="tw:min-w-0 tw:gap-0.5" direction="col">
              <Typography
                as="h2"
                className="tw:text-primary"
                data-testid="announcement-form-title"
                size="text-md"
                weight="semibold">
                {title}
              </Typography>
              <Typography as="p" className="tw:text-tertiary" size="text-sm">
                {description}
              </Typography>
            </Box>
          </Dialog.Header>

          <Dialog.Content>
            <HookForm
              className="tw:flex tw:flex-col tw:gap-5"
              data-testid="announcement-form"
              form={form}
              id="announcement-form"
              onSubmit={form.handleSubmit(onSubmit)}>
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
                <Box className="tw:gap-4">
                  <FormField
                    control={form.control}
                    name="customTypeName"
                    rules={{
                      required: requiredMessage(t('label.custom-name')),
                      maxLength: CUSTOM_TYPE_NAME_MAX_LENGTH,
                      // A name of only spaces would pass `required` and then
                      // be trimmed away on submit, leaving a Custom badge.
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
                        <FieldError
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
                  required: true,
                  minLength: TITLE_MIN_LENGTH,
                  maxLength: TITLE_MAX_LENGTH,
                }}>
                {({ field, fieldState }) => (
                  <Input
                    isRequired
                    data-testid="title"
                    hint={fieldState.error?.message}
                    id="title"
                    isInvalid={Boolean(fieldState.error)}
                    label={t('label.title')}
                    placeholder={t('label.enter-entity', {
                      entity: t('label.title'),
                    })}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              </FormField>

              <Box className="tw:gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  rules={{
                    // Moving the start can invalidate an end that was fine
                    // against the old one, so the other field is re-judged
                    // here rather than only on the next submit.
                    deps: ['endTime'],
                    validate: (value) =>
                      value != null || requiredMessage(t('label.start-date')),
                  }}>
                  {({ field, fieldState }) => (
                    <DateField
                      error={fieldState.error?.message}
                      id="startTime"
                      label={t('label.start-date')}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>

                <FormField
                  control={form.control}
                  name="endTime"
                  rules={{
                    // The ordering rule lives on the field the user can fix.
                    // Both modals still refuse an inverted window on submit,
                    // but that arrives as a toast after the fact; stated here
                    // it keeps submit disabled and names the problem in place.
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
                    <DateField
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
                  // The editor emits markup even when blank, so emptiness is
                  // judged on content rather than on the raw string.
                  validate: (value) =>
                    !isDescriptionContentEmpty(value) ||
                    requiredMessage(t('label.description')),
                }}>
                {({ field, fieldState }) => (
                  <Box className="tw:gap-1.5" direction="col">
                    <Label isRequired>{t('label.description')}</Label>
                    {/* The block editor, not core's DESCRIPTION field: that one
                        renders a plain TextArea, and an announcement's
                        description is markdown that the banner and drawer both
                        render through RichTextEditorPreviewerV1. */}
                    <RichTextEditor
                      data-testid="description"
                      initialValue={field.value}
                      placeHolder={t('label.enter-entity-description', {
                        entity: t('label.announcement'),
                      })}
                      onTextChange={field.onChange}
                    />
                    <FieldError
                      message={fieldState.error?.message}
                      testId="description-error"
                    />
                  </Box>
                )}
              </FormField>
            </HookForm>
          </Dialog.Content>

          <Dialog.Footer>
            <Button color="secondary" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            {/* Both modals register with `mode: 'onChange'`, so `isValid`
                tracks the fields live rather than only after a submit. */}
            <Button
              color="primary"
              data-testid="announcement-submit"
              id="announcement-submit"
              isDisabled={!form.formState.isValid}
              isLoading={isSaving}
              onClick={() => form.handleSubmit(onSubmit)()}>
              {submitLabel}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default AnnouncementForm;
