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

import type { TypographyColor } from '@openmetadata/ui-core-components';
import {
  Button,
  ButtonUtility,
  FormField,
  FormItemLabel,
  Input,
  Typography,
  useFieldDoc,
} from '@openmetadata/ui-core-components';
import {
  Alert,
  Browser,
  Moon,
  Plus,
  Sparkle,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import type { FC, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import LogoPreview from './LogoPreview';
import {
  isValidUrl,
  LogoUrlField as LogoUrlFieldConfig,
  LogoUrlKey,
  ThemeFormValues,
} from './ThemeSettings.utils';
import { ImageCheck, ImageStatus, useImageCheck } from './useImageCheck';

const PREVIEW_COLUMN = 'tw:flex tw:w-33';
const STATUS_ERROR_KEYS: Partial<Record<ImageStatus, string>> = {
  invalid: 'message.enter-full-url-starting-with-https',
  error: 'message.image-url-load-error',
};
const PREVIEW_COLUMNS = 'tw:flex tw:w-68 tw:shrink-0 tw:gap-2';

type MessageTone = 'error' | 'warning' | 'hint';

const TONE_COLORS: Record<MessageTone, TypographyColor> = {
  error: 'danger',
  warning: 'warning',
  hint: 'secondary',
};

interface FieldMessageProps {
  tone: MessageTone;
  testId: string;
  children: ReactNode;
}

const FieldMessage = ({ tone, testId, children }: FieldMessageProps) => (
  <Typography
    className="tw:flex tw:items-start tw:gap-1.5"
    color={TONE_COLORS[tone]}
    data-testid={testId}
    size="text-sm">
    {tone !== 'hint' && <Alert className="tw:mt-0.5 tw:shrink-0" size={16} />}
    {children}
  </Typography>
);

const Caption: FC<{ icon: FC<{ size?: number }>; label: string }> = ({
  icon: Icon,
  label,
}) => (
  <div className={PREVIEW_COLUMN}>
    <Typography
      className="tw:flex tw:items-center tw:gap-1"
      color="secondary"
      size="text-xs">
      <Icon size={12} />
      {label}
    </Typography>
  </div>
);

type ThemeForm = UseFormReturn<ThemeFormValues>;

interface UrlInputProps {
  form: ThemeForm;
  name: LogoUrlKey;
  labelKey: string;
  placeholder: string;
  doc?: string;
  check: ImageCheck;
  /** Rendered between the label and the input (preview captions). */
  labelAddon?: ReactNode;
  /** Rendered beside the input (previews or a remove button). */
  inputAddon: ReactNode;
  /** Shown when there is no error to report. */
  warning?: string;
}

const UrlInput = ({
  form,
  name,
  labelKey,
  placeholder,
  doc,
  check,
  labelAddon,
  inputAddon,
  warning,
}: UrlInputProps) => {
  const { t } = useTranslation();
  const label = t(labelKey);
  const fieldDocProps = useFieldDoc({ name, label, doc });

  return (
    <FormField
      control={form.control}
      name={name}
      rules={{
        validate: (value: string) =>
          !value ||
          isValidUrl(value) ||
          t('message.enter-full-url-starting-with-https'),
      }}>
      {({ field, fieldState }) => {
        const isInvalid =
          Boolean(fieldState.error) ||
          check.status === 'invalid' ||
          check.status === 'error';
        const renderMessage = () => {
          // Invalid URLs are flagged as the admin types, not only on submit.
          const statusErrorKey = STATUS_ERROR_KEYS[check.status];
          const errorMessage =
            fieldState.error?.message ?? (statusErrorKey && t(statusErrorKey));
          if (errorMessage) {
            return (
              <FieldMessage testId={`${name}-error`} tone="error">
                {errorMessage}
              </FieldMessage>
            );
          }
          if (check.status === 'loading') {
            return (
              <FieldMessage testId={`${name}-checking`} tone="hint">
                {t('message.checking-image')}
              </FieldMessage>
            );
          }

          return (
            warning && (
              <FieldMessage testId={`${name}-warning`} tone="warning">
                {warning}
              </FieldMessage>
            )
          );
        };

        return (
          <div className="tw:flex tw:flex-col tw:gap-1.5" {...fieldDocProps}>
            <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
              <FormItemLabel label={label} />
              {labelAddon}
            </div>
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
              <div className="tw:min-w-60 tw:flex-1">
                <Input
                  aria-label={label}
                  data-testid={name}
                  isInvalid={isInvalid}
                  name={name}
                  placeholder={placeholder}
                  value={field.value ?? ''}
                  onBlur={() => {
                    const trimmed = (field.value ?? '').trim();
                    if (trimmed !== field.value) {
                      field.onChange(trimmed);
                    }
                    field.onBlur();
                  }}
                  onChange={field.onChange}
                />
              </div>
              {inputAddon}
            </div>
            {renderMessage()}
          </div>
        );
      }}
    </FormField>
  );
};

type DarkVariant = NonNullable<LogoUrlFieldConfig['dark']>;

const PreviewCaptions = ({ hasDark }: { hasDark: boolean }) => {
  const { t } = useTranslation();

  return (
    <div className={PREVIEW_COLUMNS}>
      {hasDark ? (
        <>
          <Caption icon={Sparkle} label={t('label.light')} />
          <Caption icon={Moon} label={t('label.dark')} />
        </>
      ) : (
        <Caption icon={Browser} label={t('label.browser-tab')} />
      )}
    </div>
  );
};

interface PreviewsProps {
  name: LogoUrlKey;
  dark?: DarkVariant;
  isMonogram: boolean;
  url: string;
  darkUrl: string;
  lightCheck: ImageCheck;
  darkCheck: ImageCheck;
}

/** The dark tile falls back to the light logo, as the app does. */
const Previews = ({
  name,
  dark,
  isMonogram,
  url,
  darkUrl,
  lightCheck,
  darkCheck,
}: PreviewsProps) => (
  <div className={PREVIEW_COLUMNS}>
    <div className={PREVIEW_COLUMN}>
      <LogoPreview
        isMonogram={isMonogram}
        status={lightCheck.status}
        testId={`${name}-preview`}
        theme="light"
        url={url}
      />
    </div>
    {dark && (
      <div className={PREVIEW_COLUMN}>
        <LogoPreview
          isMonogram={isMonogram}
          status={(darkUrl ? darkCheck : lightCheck).status}
          testId={`${dark.name}-preview`}
          theme="dark"
          url={darkUrl || url}
        />
      </div>
    )}
  </div>
);

interface DarkVariantFieldProps {
  form: ThemeForm;
  dark: DarkVariant;
  doc?: string;
  check: ImageCheck;
  isOpen: boolean;
  onOpen: () => void;
  onRemove: () => void;
}

const DarkVariantField = ({
  form,
  dark,
  doc,
  check,
  isOpen,
  onOpen,
  onRemove,
}: DarkVariantFieldProps) => {
  const { t } = useTranslation();

  if (!isOpen) {
    return (
      <div>
        <Button
          color="link-color"
          data-testid={`${dark.name}-add`}
          iconLeading={Plus}
          size="md"
          onPress={onOpen}>
          {t('label.add-dark-mode-version')}
        </Button>
      </div>
    );
  }

  return (
    <div className="tw:mt-1.5">
      <UrlInput
        check={check}
        doc={doc}
        form={form}
        inputAddon={
          <div className={PREVIEW_COLUMNS}>
            <ButtonUtility
              color="tertiary"
              data-testid={`${dark.name}-remove`}
              icon={XClose}
              size="xl"
              tooltip={t('label.remove-dark-mode-version')}
              onPress={onRemove}
            />
          </div>
        }
        labelKey={dark.labelKey}
        name={dark.name}
        placeholder={dark.placeholder}
      />
    </div>
  );
};

interface LogoUrlFieldProps {
  // Passed explicitly: core HookForm provides its own react-hook-form context.
  form: ThemeForm;
  config: LogoUrlFieldConfig;
  docs: Record<string, string>;
  /** Reports whether a URL is still being checked or failed to load. */
  onBlockingChange: (name: LogoUrlKey, isBlocking: boolean) => void;
}

const BLOCKING_STATUSES: ImageStatus[] = ['invalid', 'loading', 'error'];

// Only URLs edited in this session block Save, so a saved logo that no longer
// loads (or is unreachable from this browser) cannot hold up a colour change.
const blocksSave = (
  dirtyFields: Partial<Record<LogoUrlKey, boolean>>,
  key: LogoUrlKey | undefined,
  { status }: ImageCheck
) => Boolean(key && dirtyFields[key]) && BLOCKING_STATUSES.includes(status);

/** One logo URL with its light/dark previews and optional dark-mode variant. */
const LogoUrlField = ({
  form,
  config: { name, labelKey, placeholder, isMonogram, dark },
  docs,
  onBlockingChange,
}: LogoUrlFieldProps) => {
  const { t } = useTranslation();
  // toThemeFormValues seeds every key with a string, so watched values are never undefined.
  const url = useWatch({ control: form.control, name });
  // Watching `name` again when there is no dark variant keeps the hook call unconditional.
  const watchedDark = useWatch({
    control: form.control,
    name: dark?.name ?? name,
  });
  const darkUrl = dark ? watchedDark : '';
  const [isDarkOpen, setIsDarkOpen] = useState(false);
  const lightCheck = useImageCheck(url);
  const darkCheck = useImageCheck(darkUrl);
  const { dirtyFields } = useFormState({ control: form.control });
  const isBlocking =
    blocksSave(dirtyFields, name, lightCheck) ||
    blocksSave(dirtyFields, dark?.name, darkCheck);
  const isHardToSee = !darkUrl && lightCheck.isHardToSeeOnDark;

  useEffect(() => {
    onBlockingChange(name, isBlocking);
  }, [name, isBlocking, onBlockingChange]);

  const removeDark = (variant: DarkVariant) => {
    form.setValue(variant.name, '', { shouldDirty: true });
    setIsDarkOpen(false);
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      <UrlInput
        check={lightCheck}
        doc={docs[name]}
        form={form}
        inputAddon={
          <Previews
            dark={dark}
            darkCheck={darkCheck}
            darkUrl={darkUrl}
            isMonogram={isMonogram}
            lightCheck={lightCheck}
            name={name}
            url={url}
          />
        }
        labelAddon={<PreviewCaptions hasDark={Boolean(dark)} />}
        labelKey={labelKey}
        name={name}
        placeholder={placeholder}
        warning={
          dark && isHardToSee
            ? t('message.logo-hard-to-see-in-dark-mode')
            : undefined
        }
      />
      {dark && (
        <DarkVariantField
          check={darkCheck}
          dark={dark}
          doc={docs[dark.name]}
          form={form}
          isOpen={isDarkOpen || Boolean(darkUrl)}
          onOpen={() => setIsDarkOpen(true)}
          onRemove={() => removeDark(dark)}
        />
      )}
    </div>
  );
};

export default LogoUrlField;
