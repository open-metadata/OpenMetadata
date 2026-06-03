/*
 *  Copyright 2025 Collate.
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
  Input,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import {
  Eye,
  EyeOff,
  HelpCircle,
  InfoCircle,
  UploadCloud01,
} from '@untitledui/icons';
import classNames from 'classnames';
import { ChangeEvent, ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Transi18next } from '../../../../../../utils/i18next/LocalUtil';
import './design-controls.less';

const HINT_TOOLTIP_THRESHOLD = 100;

const PEM_PRIVATE_KEY = /-----BEGIN (?:RSA |ENCRYPTED )?PRIVATE KEY-----/;

export const isValidPrivateKey = (value?: string): boolean =>
  !value || PEM_PRIVATE_KEY.test(value);

export const FieldLabel = ({
  id,
  hint,
  label,
  required,
  rightSlot,
}: {
  id?: string;
  hint?: ReactNode;
  label: ReactNode;
  required?: boolean;
  rightSlot?: ReactNode;
}) => {
  const isLongHint =
    typeof hint === 'string' && hint.length > HINT_TOOLTIP_THRESHOLD;

  return (
    <div className="design-field-label tw:mb-1.5 tw:flex tw:flex-wrap tw:items-baseline tw:gap-x-1.5 tw:gap-y-0.5">
      <label
        className="tw:min-w-0 tw:max-w-full tw:text-sm tw:font-medium tw:leading-[17px] tw:text-secondary"
        htmlFor={id}>
        {label}
      </label>
      {required && (
        <span className="tw:shrink-0 tw:text-sm tw:font-semibold tw:leading-[17px] tw:text-error-primary">
          *
        </span>
      )}
      {isLongHint && (
        <Tooltip title={hint as string}>
          <TooltipTrigger className="tw:cursor-pointer tw:text-fg-quaternary tw:transition tw:duration-200 hover:tw:text-fg-quaternary_hover">
            <HelpCircle className="tw:size-3.5" />
          </TooltipTrigger>
        </Tooltip>
      )}
      {rightSlot && <span className="tw:ml-auto">{rightSlot}</span>}
    </div>
  );
};

export const FieldHint = ({
  hint,
  error,
}: {
  hint?: ReactNode;
  error?: string;
}) =>
  error || hint ? (
    <div
      className={classNames(
        'tw:mt-1.5 tw:text-xs tw:leading-[18px]',
        error ? 'tw:text-error-primary' : 'tw:text-tertiary'
      )}>
      {error || hint}
    </div>
  ) : null;

const frameClass = (
  focused: boolean,
  invalid: boolean,
  multiline: boolean,
  disabled: boolean
) =>
  classNames(
    'design-control-frame tw:flex tw:gap-2 tw:rounded-[8px] tw:bg-primary',
    multiline
      ? 'tw:items-start tw:min-h-[92px] tw:p-3'
      : 'tw:items-center tw:min-h-[38px] tw:px-3',
    invalid && 'design-control-frame-invalid',
    focused && !disabled && 'design-control-frame-focused',
    disabled && 'design-control-frame-disabled'
  );

const RevealButton = ({
  reveal,
  onToggle,
  alignTop,
}: {
  reveal: boolean;
  onToggle: () => void;
  alignTop?: boolean;
}) => (
  <button
    className={classNames(
      'tw:flex tw:shrink-0 tw:cursor-pointer tw:text-fg-quaternary hover:tw:text-fg-quaternary_hover',
      alignTop && 'tw:self-start'
    )}
    tabIndex={-1}
    type="button"
    onClick={onToggle}>
    {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
  </button>
);

export interface DesignControlProps {
  id?: string;
  testId?: string;
  label: ReactNode;
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  autofocus?: boolean;
  hint?: ReactNode;
  error?: string;
  inputMode?: 'text' | 'decimal';
  suffix?: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const DesignTextControl = ({
  id,
  testId,
  label,
  value,
  placeholder,
  required,
  disabled,
  readonly,
  autofocus,
  hint,
  error,
  inputMode,
  suffix,
  onChange,
  onFocus,
  onBlur,
}: DesignControlProps) => {
  const isLongHint =
    typeof hint === 'string' && hint.length > HINT_TOOLTIP_THRESHOLD;

  return (
    <div>
      <FieldLabel hint={hint} id={id} label={label} required={required} />

      <Input
        autoFocus={autofocus}
        className={classNames(
          'design-control-input tw:w-full tw:flex-1 tw:border-0',
          'tw:bg-transparent tw:p-0 tw:text-sm tw:text-primary',
          'tw:outline-none tw:placeholder:text-placeholder'
        )}
        data-testid={testId}
        id={id}
        inputMode={inputMode}
        isDisabled={disabled || readonly}
        placeholder={placeholder}
        value={value ?? ''}
        onBlur={onBlur}
        onChange={onChange}
        onFocus={onFocus}
      />
      {suffix && (
        <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-quaternary">
          {suffix}
        </span>
      )}
      {!isLongHint && <FieldHint error={error} hint={hint} />}
      {isLongHint && <FieldHint error={error} />}
    </div>
  );
};

export interface DesignSecretControlProps extends DesignControlProps {
  multiline?: boolean;
  allowUpload?: boolean;
}

export const DesignSecretControl = ({
  id,
  label,
  value,
  placeholder,
  required,
  disabled,
  readonly,
  autofocus,
  hint,
  error,
  multiline = false,
  allowUpload = false,
  onChange,
  onFocus,
  onBlur,
}: DesignSecretControlProps) => {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', (e) =>
        onChange((e.target?.result as string) ?? '')
      );
      reader.readAsText(file);
    }
  };

  const isLongHint =
    typeof hint === 'string' && hint.length > HINT_TOOLTIP_THRESHOLD;

  return (
    <div>
      <FieldLabel
        hint={hint}
        id={id}
        label={label}
        required={required}
        rightSlot={
          allowUpload && (
            <button
              className="tw:flex tw:cursor-pointer tw:items-center tw:gap-1 tw:text-xs tw:font-medium tw:text-brand-secondary"
              type="button"
              onClick={() => fileRef.current?.click()}>
              <UploadCloud01 size={13} />
              {t('label.upload-key-file')}
            </button>
          )
        }
      />
      <div
        className={frameClass(
          focused,
          !!error,
          multiline,
          disabled || readonly || false
        )}>
        {multiline ? (
          <textarea
            autoFocus={autofocus}
            className={classNames(
              'design-control-textarea tw:w-full tw:flex-1 tw:resize-none',
              'tw:border-0 tw:bg-transparent tw:p-0 tw:font-mono',
              'tw:text-sm tw:text-primary tw:outline-none',
              'tw:placeholder:text-placeholder'
            )}
            disabled={disabled || readonly}
            id={id}
            placeholder={placeholder}
            rows={4}
            value={value ?? ''}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
          />
        ) : (
          <Input
            autoFocus={autofocus}
            className={classNames(
              'design-control-input tw:w-full tw:flex-1 tw:border-0',
              'tw:bg-transparent tw:p-0 tw:text-sm tw:text-primary',
              'tw:outline-none tw:placeholder:text-placeholder'
            )}
            id={id}
            isDisabled={disabled || readonly}
            placeholder={placeholder}
            type={reveal ? 'text' : 'password'}
            value={value ?? ''}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChange={onChange}
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
          />
        )}
        <RevealButton
          alignTop={multiline}
          reveal={reveal}
          onToggle={() => setReveal((v) => !v)}
        />
      </div>
      {allowUpload && (
        <input
          accept=".pem,.key,.txt"
          className="tw:hidden"
          ref={fileRef}
          type="file"
          onChange={handleFile}
        />
      )}
      {!isLongHint && <FieldHint error={error} hint={hint} />}
      {isLongHint && <FieldHint error={error} />}
    </div>
  );
};

export const SingleCredentialNote = ({ method }: { method: string }) => (
  <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs">
    <InfoCircle className="tw:text-fg-quaternary" size={14} />
    <span className="tw:text-tertiary">
      <Transi18next
        i18nKey="message.auth-single-credential-stored"
        renderElement={
          <strong className="tw:font-semibold tw:text-secondary" />
        }
        values={{ method }}
      />
    </span>
  </div>
);
