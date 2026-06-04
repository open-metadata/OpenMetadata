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
  Label,
  PasswordInput,
} from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { UploadCloud01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { getWidgetHint, getWidgetLabel } from './coreWidgetUtils';

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

  const displayLabel = getWidgetLabel({ hideLabel, label });
  const hint = getWidgetHint({ rawErrors, schema, options });
  const isInvalid = !!rawErrors?.length;

  const handleFileSelect = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    files[0].text().then(onChange);
  };

  if (isInputTypeFile) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-1.5">
        {displayLabel && <Label isRequired={required}>{displayLabel}</Label>}
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
      </div>
    );
  }

  return (
    <PasswordInput
      acceptedFileTypes={
        isInputTypeFileOrInput
          ? (schema.accept as string[] | undefined)
          : undefined
      }
      allowUpload={isInputTypeFileOrInput}
      autoFocus={autofocus}
      hint={hint}
      id={id}
      isDisabled={disabled || readonly}
      isInvalid={isInvalid}
      isRequired={required}
      label={displayLabel}
      placeholder={placeholder}
      uploadLabel={t('label.upload-key-file')}
      value={value}
      onBlur={() => onBlur(id, value)}
      onChange={onChange}
      onFocus={() => onFocus(id, value)}
    />
  );
};

export default CorePasswordWidget;
