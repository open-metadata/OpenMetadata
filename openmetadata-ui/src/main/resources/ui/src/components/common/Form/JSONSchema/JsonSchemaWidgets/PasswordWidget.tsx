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
import { CredentialFileInput } from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { Input } from 'antd';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_ASTERISKS_REGEX } from '../../../../../constants/regex.constants';
import { CredentialFileFieldType } from '../../../../../enums/CredentialFileField.enum';
import {
  getCredentialFileLabels,
  getCredentialFileValidationMessages,
  isCredentialFileFieldType,
} from '../../../../../utils/CredentialFileField.utils';

const PasswordWidget: FC<WidgetProps> = (props) => {
  const { t } = useTranslation();

  const isCredentialFile = isCredentialFileFieldType(props.schema.uiFieldType);
  const isFileOrInput =
    props.schema.uiFieldType === CredentialFileFieldType.FILE_OR_INPUT;

  const handleChange = (nextValue?: string) =>
    props.onChange(
      nextValue === '' || nextValue === undefined
        ? props.options.emptyValue ?? undefined
        : nextValue
    );

  if (isCredentialFile) {
    const acceptedFileTypes = props.schema.accept as string[] | undefined;

    // The API returns the mask in place of the stored secret. A credential file
    // field stands for it with a chip rather than putting it in an editable
    // control, and removing that chip is what clears it — the same outcome
    // #32945 gives a plain password field through `allowClear`.
    const isMasked = ALL_ASTERISKS_REGEX.test(props.value);

    return (
      <CredentialFileInput
        acceptedFileTypes={acceptedFileTypes}
        allowManualInput={isFileOrInput}
        data-testid={`credential-file-widget-${props.id}`}
        hasStoredValue={isMasked}
        id={props.id}
        isDisabled={props.disabled}
        isReadOnly={props.readonly}
        isRequired={props.required}
        labels={getCredentialFileLabels(t)}
        placeholder={props.placeholder}
        validationMessages={getCredentialFileValidationMessages(
          t,
          acceptedFileTypes
        )}
        value={isMasked ? undefined : props.value}
        onBlur={() => props.onBlur(props.id, props.value)}
        onChange={handleChange}
        onFocus={() => props.onFocus(props.id, props.value)}
      />
    );
  }

  return (
    <Input.Password
      allowClear
      autoComplete="off"
      // eslint-disable-next-line jsx-a11y/no-autofocus -- focus is driven by the RJSF widget schema
      autoFocus={props.autofocus}
      data-testid={`password-input-widget-${props.id}`}
      disabled={props.disabled}
      id={props.id}
      name={props.name}
      placeholder={props.placeholder}
      readOnly={props.readonly}
      required={props.required}
      value={props.value}
      onBlur={() => props.onBlur(props.id, props.value)}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={() => props.onFocus(props.id, props.value)}
    />
  );
};

export default PasswordWidget;
