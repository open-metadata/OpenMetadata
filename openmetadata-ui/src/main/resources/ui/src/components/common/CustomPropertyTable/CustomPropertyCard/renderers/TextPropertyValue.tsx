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
import { Box, Input } from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { isNil, toNumber } from 'lodash';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMAIL_REG_EX,
  TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX,
} from '../../../../../constants/regex.constants';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.types';
import { getPropertyTypeMeta } from '../CustomPropertyCard.utils';
import { PropertyValueChip } from '../PropertyValueChip';

interface TextFieldConfig {
  testId: string;
  inputType: 'text' | 'number' | 'email';
  getPlaceholder: (t: TFunction) => string;
  getHint?: (t: TFunction) => string;
  validate?: (value: string, t: TFunction) => string | undefined;
  toSavedValue?: (value: string) => unknown;
}

const EMAIL_MIN_LENGTH = 6;
const EMAIL_MAX_LENGTH = 127;

const DEFAULT_TEXT_CONFIG: TextFieldConfig = {
  testId: 'value-input',
  inputType: 'text',
  getPlaceholder: (t) => t('label.enter-property-value'),
};

const TEXT_FIELD_CONFIG: Record<string, TextFieldConfig> = {
  integer: { ...DEFAULT_TEXT_CONFIG, inputType: 'number' },
  number: { ...DEFAULT_TEXT_CONFIG, inputType: 'number' },
  email: {
    testId: 'email-input',
    inputType: 'email',
    getPlaceholder: () => 'john@doe.com',
    validate: (value, t) =>
      value.length < EMAIL_MIN_LENGTH ||
      value.length > EMAIL_MAX_LENGTH ||
      !EMAIL_REG_EX.test(value)
        ? t('message.email-is-invalid')
        : undefined,
  },
  timestamp: {
    testId: 'timestamp-input',
    inputType: 'text',
    getPlaceholder: (t) => t('message.unix-epoch-time-in-ms', { prefix: '' }),
    validate: (value, t) =>
      TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX.test(value)
        ? undefined
        : t('message.invalid-unix-epoch-time-milliseconds'),
    toSavedValue: toNumber,
  },
  duration: {
    testId: 'duration-input',
    inputType: 'text',
    getPlaceholder: (t) => t('message.duration-in-iso-format'),
  },
};

const getTextFieldConfig = (typeName?: string) =>
  TEXT_FIELD_CONFIG[typeName ?? ''] ?? DEFAULT_TEXT_CONFIG;

const TextPropertyView = ({ property, value }: PropertyViewProps) => (
  <PropertyValueChip
    icon={getPropertyTypeMeta(property.propertyType.name).icon}>
    {String(value)}
  </PropertyValueChip>
);

const TextPropertyEdit = ({
  property,
  value,
  isSaving,
  onSave,
  formId,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const config = getTextFieldConfig(property.propertyType.name);
  const [inputValue, setInputValue] = useState(
    isNil(value) ? '' : String(value)
  );
  const [error, setError] = useState<string>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    const validationError = trimmed ? config.validate?.(trimmed, t) : undefined;

    if (validationError) {
      setError(validationError);

      return;
    }

    onSave(
      trimmed && config.toSavedValue ? config.toSavedValue(trimmed) : trimmed
    );
  };

  return (
    <form noValidate id={formId} onSubmit={handleSubmit}>
      <Box align="start" gap={2}>
        <Input
          aria-label={property.displayName || property.name}
          className="tw:flex-1"
          hint={error}
          inputDataTestId={config.testId}
          isDisabled={isSaving}
          isInvalid={Boolean(error)}
          placeholder={config.getPlaceholder(t)}
          type={config.inputType}
          value={inputValue}
          onChange={(nextValue) => {
            setInputValue(nextValue);
            setError(undefined);
          }}
        />
      </Box>
    </form>
  );
};

export const textPropertyRenderer: CustomPropertyRenderer = {
  View: TextPropertyView,
  Edit: TextPropertyEdit,
  getEmptyHint: (property, t) =>
    property.propertyType.name === 'duration'
      ? t('message.duration-in-iso-format')
      : '',
};
