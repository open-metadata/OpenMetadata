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
import { Input } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { GlossaryTermPropertyError } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';

interface GlossaryTermPropertyEnumFieldProps {
  value: string;
  error?: GlossaryTermPropertyError;
  onChange: (value: string) => void;
}

const GlossaryTermPropertyEnumField = ({
  value,
  error,
  onChange,
}: GlossaryTermPropertyEnumFieldProps) => {
  const { t } = useTranslation();
  const hint = error
    ? t(error.key, error.values)
    : t('message.separate-values-with-commas');

  return (
    <Input
      hint={hint}
      inputDataTestId="property-enum-values-input"
      isInvalid={Boolean(error)}
      label={t('label.allowed-values')}
      value={value}
      onChange={onChange}
    />
  );
};

export default GlossaryTermPropertyEnumField;
