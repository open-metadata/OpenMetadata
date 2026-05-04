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
  Button,
  FileTrigger,
  HintText,
  Label,
  RadioButton,
  RadioGroup,
} from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { Eye, EyeOff, UploadCloud01 } from '@untitledui/icons';
import { useState } from 'react';
import {
  Group as AriaGroup,
  Input as AriaInput,
  TextField as AriaTextField,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { CertificationInputType } from '../../../../enums/PasswordWidget.enum';
import { getWidgetHint, getWidgetLabel } from './coreWidgetUtils';

interface PasswordInputFieldProps {
  id: string;
  value: string | undefined;
  label?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  autofocus?: boolean;
  isInvalid?: boolean;
  hideLabel?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onFocus: () => void;
}

const PasswordInputField = ({
  id,
  value,
  label,
  hint,
  placeholder,
  required,
  disabled,
  readonly,
  autofocus,
  isInvalid,
  hideLabel,
  onChange,
  onBlur,
  onFocus,
}: PasswordInputFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AriaTextField
      autoFocus={autofocus}
      className="tw:flex tw:w-full tw:flex-col tw:gap-1.5"
      id={id}
      isDisabled={disabled || readonly}
      isInvalid={isInvalid}
      isRequired={required}
      type={showPassword ? 'text' : 'password'}
      value={value ?? ''}
      onBlur={onBlur}
      onChange={onChange}
      onFocus={onFocus}>
      {!hideLabel && label && <Label isRequired={required}>{label}</Label>}
      <AriaGroup
        className={({ isFocusWithin, isDisabled, isInvalid: groupInvalid }) =>
          [
            'tw:relative tw:flex tw:w-full tw:items-center tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-inset tw:ring-primary tw:transition-shadow tw:duration-100 tw:ease-linear',
            isFocusWithin && !isDisabled ? 'tw:ring-2 tw:ring-brand' : '',
            isDisabled
              ? 'tw:cursor-not-allowed tw:bg-disabled_subtle tw:ring-disabled'
              : '',
            groupInvalid ? 'tw:ring-error_subtle' : '',
            groupInvalid && isFocusWithin ? 'tw:ring-2 tw:ring-error' : '',
          ]
            .filter(Boolean)
            .join(' ')
        }>
        <AriaInput
          className="tw:w-full tw:bg-transparent tw:px-3 tw:py-2 tw:pr-9 tw:text-sm tw:text-primary
          tw:outline-hidden tw:placeholder:text-placeholder disabled:tw:cursor-not-allowed disabled:tw:text-disabled"
          placeholder={placeholder}
        />
        <button
          className="tw:absolute tw:right-3 tw:flex tw:cursor-pointer tw:items-center tw:text-fg-quaternary tw:transition-colors tw:duration-200 hover:tw:text-fg-quaternary_hover"
          tabIndex={-1}
          type="button"
          onClick={() => setShowPassword((v) => !v)}>
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </AriaGroup>
      {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
    </AriaTextField>
  );
};

const CorePasswordWidget = (props: WidgetProps) => {
  const {
    id,
    schema,
    label,
    hideLabel,
    required,
    disabled,
    readonly,
    autofocus,
    value,
    placeholder,
    rawErrors,
    options,
    onChange,
    onBlur,
    onFocus,
  } = props;
  const { t } = useTranslation();
  const isInputTypeFile = schema.uiFieldType === 'file';
  const isInputTypeFileOrInput = schema.uiFieldType === 'fileOrInput';
  const [inputType, setInputType] = useState<CertificationInputType>(
    CertificationInputType.FILE_UPLOAD
  );

  const displayLabel = getWidgetLabel({ hideLabel, label });
  const hint = getWidgetHint({ rawErrors, schema, options });
  const isInvalid = !!rawErrors?.length;

  const handleFileSelect = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const reader = new FileReader();
    reader.readAsText(files[0]);
    reader.addEventListener('load', (e) => {
      onChange(e.target?.result as string);
    });
  };

  const fileUploadTrigger = (
    <FileTrigger onSelect={handleFileSelect}>
      <Button
        color="secondary"
        isDisabled={disabled || readonly}
        size="sm"
        type="button">
        <UploadCloud01 data-icon size={14} />
        {t('message.upload-file')}
      </Button>
    </FileTrigger>
  );

  if (isInputTypeFile) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-1.5">
        {displayLabel && <Label isRequired={required}>{displayLabel}</Label>}
        {fileUploadTrigger}
      </div>
    );
  }

  if (isInputTypeFileOrInput) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-3">
        {displayLabel && <Label isRequired={required}>{displayLabel}</Label>}
        <RadioGroup
          value={inputType}
          onChange={(v) => setInputType(v as CertificationInputType)}>
          <RadioButton
            label={t('message.upload-file')}
            value={CertificationInputType.FILE_UPLOAD}
          />
          <RadioButton
            label={t('label.enter-file-content')}
            value={CertificationInputType.FILE_PATH}
          />
        </RadioGroup>
        {inputType === CertificationInputType.FILE_UPLOAD ? (
          fileUploadTrigger
        ) : (
          <PasswordInputField
            hideLabel
            autofocus={autofocus}
            disabled={disabled}
            hint={hint}
            id={id}
            isInvalid={isInvalid}
            placeholder={placeholder}
            readonly={readonly}
            value={value}
            onBlur={() => onBlur(id, value)}
            onChange={onChange}
            onFocus={() => onFocus(id, value)}
          />
        )}
      </div>
    );
  }

  return (
    <PasswordInputField
      autofocus={autofocus}
      disabled={disabled}
      hint={hint}
      id={id}
      isInvalid={isInvalid}
      label={displayLabel}
      placeholder={placeholder}
      readonly={readonly}
      value={value}
      onBlur={() => onBlur(id, value)}
      onChange={onChange}
      onFocus={() => onFocus(id, value)}
    />
  );
};

export default CorePasswordWidget;
