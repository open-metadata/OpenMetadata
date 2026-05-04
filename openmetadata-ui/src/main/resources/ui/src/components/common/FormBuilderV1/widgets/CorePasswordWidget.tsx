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
  Box,
  Button,
  FileTrigger,
  Label,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { UploadCloud01 } from '@untitledui/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CertificationInputType } from '../../../../enums/PasswordWidget.enum';
import CoreInputWidget from './CoreInputWidget';
import { getWidgetLabel } from './coreWidgetUtils';

const CorePasswordWidget = (props: WidgetProps) => {
  const { schema, label, hideLabel, required, disabled, readonly, onChange } =
    props;
  const { t } = useTranslation();
  const isInputTypeFile = schema.uiFieldType === 'file';
  const isInputTypeFileOrInput = schema.uiFieldType === 'fileOrInput';
  const [inputType, setInputType] = useState<CertificationInputType>(
    CertificationInputType.FILE_UPLOAD
  );

  const displayLabel = getWidgetLabel({ hideLabel, label });

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
        <Box align="center" direction="row" gap={1}>
          <UploadCloud01 data-icon size={14} />
          <Typography size="text-sm">{t('message.upload-file')}</Typography>
        </Box>
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
          <CoreInputWidget
            {...props}
            hideLabel
            options={{ ...props.options, inputType: 'password' }}
          />
        )}
      </div>
    );
  }

  return (
    <CoreInputWidget
      {...props}
      options={{ ...props.options, inputType: 'password' }}
    />
  );
};

export default CorePasswordWidget;
