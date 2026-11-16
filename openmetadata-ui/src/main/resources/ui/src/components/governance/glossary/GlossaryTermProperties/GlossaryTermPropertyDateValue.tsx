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
  DatePicker,
  HintText,
  Label,
  parseDate,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { GlossaryTermPropertyValueFieldProps } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';

const GlossaryTermPropertyDateValue = ({
  value,
  label,
  error,
  errorMessage,
  testId,
  onChange,
}: GlossaryTermPropertyValueFieldProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5" data-testid={testId}>
      <Label>{label}</Label>
      <DatePicker
        aria-label={label}
        isInvalid={Boolean(error)}
        triggerVariant="input"
        value={value ? parseDate(value) : null}
        onChange={(selected) => onChange(selected?.toString() ?? '')}
      />
      {value && (
        <Button
          className="tw:self-start"
          color="link-gray"
          size="xs"
          onPress={() => onChange('')}>
          {t('label.clear')}
        </Button>
      )}
      {errorMessage && <HintText isInvalid>{errorMessage}</HintText>}
    </div>
  );
};

export default GlossaryTermPropertyDateValue;
