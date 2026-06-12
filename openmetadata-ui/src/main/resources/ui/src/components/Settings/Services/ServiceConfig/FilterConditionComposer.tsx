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
import { Button, Input, Select } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import classNames from 'classnames';
import { KeyboardEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OPERATOR_LABEL_KEYS } from './FiltersConfigForm.constants';
import { FilterCondition, FilterOperator } from './FiltersConfigForm.types';

export function OperatorSelect({
  value,
  onChange,
}: Readonly<{
  value: FilterOperator;
  onChange: (value: FilterOperator) => void;
}>) {
  const { t } = useTranslation();

  return (
    <span className="tw:relative tw:flex-[0_0_148px]">
      <Select
        data-testid="relation-selector"
        size="sm"
        value={value}
        onChange={(key) => onChange(key as FilterOperator)}>
        {Object.entries(OPERATOR_LABEL_KEYS).map(([operator, labelKey]) => (
          <Select.Item id={operator} key={operator} label={t(labelKey)} />
        ))}
      </Select>
    </span>
  );
}

export function ConditionComposer({
  defaultOperator,
  fieldName,
  onAdd,
  onFocus,
  placeholder,
  tone = 'include',
}: Readonly<{
  defaultOperator: FilterOperator;
  fieldName: string;
  onAdd: (condition: FilterCondition) => void;
  onFocus: (fieldName: string) => void;
  placeholder: string;
  tone?: 'exclude' | 'include';
}>) {
  const { t } = useTranslation();
  const [operator, setOperator] = useState<FilterOperator>(defaultOperator);
  const [value, setValue] = useState('');
  const trimmedValue = value.trim();
  const isRegex = operator === 'regex';

  const commit = useCallback(() => {
    if (!trimmedValue) {
      return;
    }

    onAdd({ op: operator, value: trimmedValue });
    setValue('');
  }, [onAdd, operator, trimmedValue]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  };

  return (
    <div className="tw:flex tw:items-center tw:gap-2">
      <OperatorSelect value={operator} onChange={setOperator} />
      <Input
        className={classNames(
          'tw:flex-1 tw:min-w-0',
          isRegex && 'tw:font-mono'
        )}
        data-testid={`${tone}-filter-input`}
        placeholder={isRegex ? '^prefix.*$' : placeholder}
        value={value}
        onBlur={() => onFocus('')}
        onChange={setValue}
        onFocus={() => onFocus(fieldName)}
        onKeyDown={handleKeyDown}
      />
      <Button
        color={tone === 'exclude' ? 'primary-destructive' : 'primary'}
        data-testid={`${tone}-add-button`}
        iconLeading={<Plus size={14} />}
        isDisabled={!trimmedValue}
        size="sm"
        type="button"
        onPress={commit}>
        {t('label.add')}
      </Button>
    </div>
  );
}
