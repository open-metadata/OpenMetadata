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
  CredentialFileInput,
  PasswordInput,
} from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { useTranslation } from 'react-i18next';
import { ALL_ASTERISKS_REGEX } from '../../../../constants/regex.constants';
import {
  CredentialFileFieldType,
  getCredentialFileLabels,
  getCredentialFileValidationMessages,
  isCredentialFileFieldType,
} from '../../../../utils/CredentialFileField.utils';
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

  const isCredentialFile = isCredentialFileFieldType(schema.uiFieldType);
  const isFileOrInput =
    schema.uiFieldType === CredentialFileFieldType.FILE_OR_INPUT;

  const displayLabel = getWidgetLabel({ hideLabel, label });
  const hint = getWidgetHint({ rawErrors, schema, options });
  const isInvalid = !!rawErrors?.length;

  const handleChange = (nextValue?: string) =>
    onChange(
      nextValue === '' || nextValue === undefined
        ? options.emptyValue ?? undefined
        : nextValue
    );

  if (isCredentialFile) {
    const acceptedFileTypes = schema.accept as string[] | undefined;

    // The API returns the mask in place of the stored secret. Handing it to the
    // field would render it as if it were the credential — a short value the
    // user could plausibly edit and submit as the real one. It is withheld and
    // flagged instead, so the field shows a chip standing for the stored
    // credential: `formData` is left untouched while the field is unmodified,
    // and removing the chip clears it exactly as emptying the old input did.
    const isMasked =
      typeof value === 'string' && ALL_ASTERISKS_REGEX.test(value);

    return (
      <CredentialFileInput
        acceptedFileTypes={acceptedFileTypes}
        allowManualInput={isFileOrInput}
        data-testid={`credential-file-widget-${id}`}
        hasStoredValue={isMasked}
        hint={hint}
        id={id}
        isDisabled={disabled}
        isInvalid={isInvalid}
        isReadOnly={readonly}
        isRequired={required}
        label={displayLabel}
        labels={getCredentialFileLabels(t)}
        placeholder={placeholder}
        validationMessages={getCredentialFileValidationMessages(
          t,
          acceptedFileTypes
        )}
        value={isMasked ? undefined : value}
        onBlur={() => onBlur(id, value)}
        onChange={handleChange}
        onFocus={() => onFocus(id, value)}
      />
    );
  }

  return (
    <PasswordInput
      // eslint-disable-next-line jsx-a11y/no-autofocus -- RJSF-driven field autofocus
      autoFocus={autofocus}
      hint={hint}
      id={id}
      isDisabled={disabled || readonly}
      isInvalid={isInvalid}
      isRequired={required}
      label={displayLabel}
      placeholder={placeholder}
      value={value}
      onBlur={() => onBlur(id, value)}
      onChange={handleChange}
      onFocus={() => onFocus(id, value)}
    />
  );
};

export default CorePasswordWidget;
