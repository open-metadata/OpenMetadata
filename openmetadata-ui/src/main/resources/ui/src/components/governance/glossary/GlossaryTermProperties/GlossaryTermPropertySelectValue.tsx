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
import { Select } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTermPropertyDatatype } from '../../../../generated/type/glossaryTermProperty';
import { GlossaryTermPropertyValueFieldProps } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';

// react-aria selects need a non-empty key, so "no value" is a sentinel that maps to ''.
const NO_VALUE_KEY = '__no-value__';

const GlossaryTermPropertySelectValue = ({
  property,
  value,
  label,
  error,
  errorMessage,
  onChange,
}: GlossaryTermPropertyValueFieldProps) => {
  const { t } = useTranslation();
  const { datatype, enumValues } = property;

  const items = useMemo(() => {
    const noValue = { id: NO_VALUE_KEY, label: t('label.no-value') };
    if (datatype === GlossaryTermPropertyDatatype.Boolean) {
      return [
        noValue,
        { id: 'true', label: t('label.true-value') },
        { id: 'false', label: t('label.false-value') },
      ];
    }

    return [
      noValue,
      ...(enumValues ?? []).map((option) => ({ id: option, label: option })),
    ];
  }, [datatype, enumValues, t]);

  return (
    <Select
      hint={errorMessage}
      isInvalid={Boolean(error)}
      items={items}
      label={label}
      placeholder={t('label.no-value')}
      value={value === '' ? NO_VALUE_KEY : value}
      onChange={(key) => {
        const next = String(key);
        onChange(next === NO_VALUE_KEY ? '' : next);
      }}>
      {(item) => <Select.Item id={item.id} label={item.label} />}
    </Select>
  );
};

export default GlossaryTermPropertySelectValue;
