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
import { GlossaryTermPropertyDatatype } from '../../../../generated/type/glossaryTermProperty';
import { PROPERTY_VALUE_PLACEHOLDERS } from '../../../../utils/governance/glossary/GlossaryTermProperties.constants';
import { GlossaryTermPropertyValueFieldProps } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';

const NUMERIC_DATATYPES: GlossaryTermPropertyDatatype[] = [
  GlossaryTermPropertyDatatype.Decimal,
  GlossaryTermPropertyDatatype.Integer,
];

const GlossaryTermPropertyTextValue = ({
  property,
  value,
  label,
  error,
  errorMessage,
  testId,
  onChange,
}: GlossaryTermPropertyValueFieldProps) => {
  const { t } = useTranslation();
  const { datatype, multiValued } = property;
  const listHint = multiValued
    ? t('message.separate-values-with-commas')
    : undefined;
  // A native number input rejects "99.5" under its default step; the value is checked as text.
  const isNumeric = NUMERIC_DATATYPES.includes(datatype) && !multiValued;

  return (
    <Input
      hint={errorMessage ?? listHint}
      inputDataTestId={testId}
      inputMode={isNumeric ? 'decimal' : undefined}
      isInvalid={Boolean(error)}
      label={label}
      placeholder={PROPERTY_VALUE_PLACEHOLDERS[datatype] ?? t('label.value')}
      value={value}
      onChange={onChange}
    />
  );
};

export default GlossaryTermPropertyTextValue;
