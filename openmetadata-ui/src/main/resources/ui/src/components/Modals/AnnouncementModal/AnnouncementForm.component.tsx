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
  Button,
  Checkbox,
  Dialog,
  FeaturedIcon,
  FormField,
  HookForm,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Announcement02, Calendar } from '@untitledui/icons';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import { CUSTOM_TYPE_NAME_MAX_LENGTH } from '../../../utils/AnnouncementsUtils';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorPureUtils';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { fromDateInputValue, toDateInputValue } from './announcementFormUtils';
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
 * A native date input rather than a component: core's `Input` is a react-aria
 * TextField, which has no `date` type, and its `DatePicker` is typed against
 * `@internationalized/date` from the design system's own node_modules, so the
 * `DateValue` it expects is a different type identity from the one this app
 * resolves. The native control is localized, keyboard-accessible and needs
 * neither a cast nor a dependency.
 *
 * The frame puts the calendar on the left. The native picker indicator is
 * stretched invisibly over the whole control instead of hidden, so a click
 * anywhere still opens the picker rather than only on the icon.
 */
// Kept as whole literals so Tailwind still sees each class.
const DATE_INPUT_CLASS = [
  'tw:relative tw:w-full tw:rounded-lg tw:bg-primary tw:py-2 tw:pr-3 tw:pl-9',
  'tw:text-sm tw:text-primary tw:shadow-xs',
  'tw:outline-1 tw:-outline-offset-1 tw:outline-primary',
  'tw:focus-visible:outline-2 tw:focus-visible:outline-brand',
  'tw:[&::-webkit-calendar-picker-indicator]:absolute',
  'tw:[&::-webkit-calendar-picker-indicator]:inset-0',
  'tw:[&::-webkit-calendar-picker-indicator]:size-full',
  'tw:[&::-webkit-calendar-picker-indicator]:cursor-pointer',
  'tw:[&::-webkit-calendar-picker-indicator]:opacity-0',
].join(' ');

const DateField = ({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
    <Label isRequired htmlFor={id}>
      {label}
    </Label>
    <div className="tw:relative">
      <Calendar
        aria-hidden
        className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-fg-quaternary"
      />
      <input
        aria-label={label}
        className={DATE_INPUT_CLASS}
        data-testid={id}
        id={id}
        type="date"
        value={toDateInputValue(value)}
        onChange={(e) => onChange(fromDateInputValue(e.target.value, value))}
      />
    </div>
  </div>
);

const FieldError = ({
  message,
  testId,
}: {
  message?: string;
  testId: string;
}) =>
  message ? (
    <span className="tw:text-sm tw:text-error-primary" data-testid={testId}>
      {message}
    </span>
  ) : null;

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
  const isCustom = form.watch('announcementType') === AnnouncementType.Custom;
  const requiredMessage = (fieldText: string) =>
    t('message.field-text-is-required', { fieldText });

  const handleTypeChange = (
    value: AnnouncementType,
    onChange: (value: AnnouncementType) => void
  ) => {
    onChange(value);
    if (value === AnnouncementType.Custom) {
      // A Custom announcement cannot be system-wide, so the flag is cleared
      // rather than left checked behind a disabled box.
      form.setValue('systemWide', false);
    } else {
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
            <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
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
            </div>
          </Dialog.Header>

          <Dialog.Content>
            <HookForm
              className="tw:flex tw:flex-col tw:gap-5"
              data-testid="announcement-form"
              form={form}
              id="announcement-form"
              onSubmit={form.handleSubmit(onSubmit)}>
              <FormField control={form.control} name="announcementType">
                {({ field }) => (
                  <div className="tw:flex tw:flex-col tw:gap-1.5">
                    <Label isRequired>{t('label.announcement-type')}</Label>
                    <AnnouncementTypeSelect
                      value={field.value}
                      onChange={(value) =>
                        handleTypeChange(value, field.onChange)
                      }
                    />
                  </div>
                )}
              </FormField>

              {isCustom && (
                <div className="tw:flex tw:gap-4">
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
                      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
                        <Input
                          isRequired
                          data-testid="custom-type-name"
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
                        <FieldError
                          message={fieldState.error?.message}
                          testId="custom-type-name-error"
                        />
                      </div>
                    )}
                  </FormField>

                  <FormField
                    control={form.control}
                    name="color"
                    rules={{ required: requiredMessage(t('label.color')) }}>
                    {({ field, fieldState }) => (
                      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
                        <Label isRequired>{t('label.color')}</Label>
                        <AnnouncementColorSelect
                          value={field.value}
                          onChange={field.onChange}
                        />
                        <FieldError
                          message={fieldState.error?.message}
                          testId="color-error"
                        />
                      </div>
                    )}
                  </FormField>
                </div>
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

              <div className="tw:flex tw:gap-4">
                <FormField control={form.control} name="startTime">
                  {({ field }) => (
                    <DateField
                      id="startTime"
                      label={t('label.start-date')}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>

                <FormField control={form.control} name="endTime">
                  {({ field }) => (
                    <DateField
                      id="endTime"
                      label={t('label.end-date')}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>
              </div>

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
                  <div className="tw:flex tw:flex-col tw:gap-1.5">
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
                  </div>
                )}
              </FormField>

              <FormField control={form.control} name="systemWide">
                {({ field }) => (
                  // A disabled control swallows hover, so the reason sits on
                  // a wrapper; a span rather than Tooltip's default button,
                  // which would nest the checkbox's input inside a button.
                  <Tooltip
                    excludeTriggerFromTabOrder
                    isDisabled={!isCustom}
                    title={t(
                      'message.announcement-system-wide-custom-disabled'
                    )}
                    triggerClassName="tw:block tw:w-fit">
                    <Checkbox
                      data-testid="announcement-system-wide"
                      hint={t('message.announcement-system-wide-hint')}
                      isDisabled={isCustom}
                      isSelected={Boolean(field.value)}
                      label={t('label.make-announcement-system-wide')}
                      onChange={field.onChange}
                    />
                  </Tooltip>
                )}
              </FormField>
            </HookForm>
          </Dialog.Content>

          <Dialog.Footer>
            <Button color="secondary" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="announcement-submit"
              id="announcement-submit"
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
