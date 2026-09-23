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
  Dialog,
  FormField,
  HookForm,
  Input,
  Label,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import { getTimeZone } from '../../../utils/date-time/DateTimeUtils';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { fromDateInputValue, toDateInputValue } from './announcementFormUtils';
import { AnnouncementFormValues } from './AnnouncementModal.interface';
import {
  AnnouncementColorSelect,
  AnnouncementTypeSelect,
} from './AnnouncementTypeField.component';

interface AnnouncementFormProps {
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
 */
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
  <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-1.5">
    <Label isRequired htmlFor={id}>
      {label}
    </Label>
    <input
      aria-label={label}
      className="tw:w-full tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:px-3 tw:py-2 tw:text-sm tw:text-primary tw:outline-brand tw:focus-visible:outline-2"
      data-testid={id}
      id={id}
      type="date"
      value={toDateInputValue(value)}
      onChange={(e) => onChange(fromDateInputValue(e.target.value, value))}
    />
  </div>
);

const TITLE_MIN_LENGTH = 5;
const TITLE_MAX_LENGTH = 124;

/**
 * The add and edit dialogs differ only in their title, submit label and where
 * their initial values come from, so they share one body rather than keeping
 * two copies of the field list in sync.
 */
const AnnouncementForm = ({
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
  const announcementType = form.watch('announcementType');

  return (
    // Not dismissable: a stray click on the backdrop would throw away a
    // half-written announcement. Escape and the close button still exit.
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid={testId}
          width={720}
          onClose={onCancel}>
          <Dialog.Header title={title} />
          <Dialog.Content>
            <HookForm
              className="tw:flex tw:flex-col tw:gap-5"
              data-testid="announcement-form"
              form={form}
              id="announcement-form"
              onSubmit={form.handleSubmit(onSubmit)}>
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
                    placeholder={t('label.announcement-title')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              </FormField>

              <FormField control={form.control} name="announcementType">
                {({ field }) => (
                  <div className="tw:flex tw:flex-col tw:gap-1.5">
                    <Label>{t('label.announcement-type')}</Label>
                    <AnnouncementTypeSelect
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        if (value !== AnnouncementType.Custom) {
                          form.clearErrors('color');
                        }
                      }}
                    />
                  </div>
                )}
              </FormField>

              {announcementType === AnnouncementType.Custom && (
                <FormField
                  control={form.control}
                  name="color"
                  rules={{
                    required: t('message.field-text-is-required', {
                      fieldText: t('label.color'),
                    }),
                  }}>
                  {({ field, fieldState }) => (
                    <div className="tw:flex tw:flex-col tw:gap-1.5">
                      <Label isRequired>{t('label.color')}</Label>
                      <AnnouncementColorSelect
                        value={field.value}
                        onChange={field.onChange}
                      />
                      {fieldState.error && (
                        <span
                          className="tw:text-sm tw:text-error-primary"
                          data-testid="color-error">
                          {fieldState.error.message}
                        </span>
                      )}
                    </div>
                  )}
                </FormField>
              )}

              <div className="tw:flex tw:gap-4">
                <FormField control={form.control} name="startTime">
                  {({ field }) => (
                    <DateField
                      id="startTime"
                      label={t('label.start-date-time-zone', {
                        timeZone: getTimeZone(),
                      })}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>

                <FormField control={form.control} name="endTime">
                  {({ field }) => (
                    <DateField
                      id="endTime"
                      label={t('label.end-date-time-zone', {
                        timeZone: getTimeZone(),
                      })}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>
              </div>

              <FormField control={form.control} name="description">
                {({ field }) => (
                  <div className="tw:flex tw:flex-col tw:gap-1.5">
                    <Label>{t('label.description')}</Label>
                    {/* The block editor, not core's DESCRIPTION field: that one
                        renders a plain TextArea, and an announcement's
                        description is markdown that the banner and drawer both
                        render through RichTextEditorPreviewerV1. */}
                    <RichTextEditor
                      data-testid="description"
                      initialValue={field.value}
                      placeHolder={t(
                        'message.write-your-announcement-lowercase'
                      )}
                      onTextChange={field.onChange}
                    />
                  </div>
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
