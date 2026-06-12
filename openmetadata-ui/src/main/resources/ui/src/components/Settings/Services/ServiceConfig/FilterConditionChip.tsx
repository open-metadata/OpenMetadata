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
import { Button } from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import classNames from 'classnames';
import { FilterCondition } from './FiltersConfigForm.types';
import { conditionKey } from './FiltersConfigForm.utils';

const chipClass = (tone: 'exclude' | 'include') =>
  classNames(
    'tw:inline-flex tw:max-w-full tw:items-center tw:gap-1 tw:rounded-full tw:px-2 tw:py-1 tw:text-xs tw:font-medium',
    tone === 'include'
      ? 'tw:border tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:text-utility-brand-700'
      : 'tw:border tw:border-utility-error-200 tw:bg-utility-error-50 tw:text-utility-error-700'
  );

export function PreviewRuleChip({
  condition,
  operatorLabel,
  tone,
}: Readonly<{
  condition: FilterCondition;
  operatorLabel: string;
  tone: 'exclude' | 'include';
}>) {
  return (
    <span
      className={classNames(
        'tw:inline-flex tw:max-w-full tw:items-center tw:gap-1 tw:rounded-full tw:px-2 tw:py-[3px] tw:text-xs tw:font-medium',
        tone === 'include'
          ? 'tw:border tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:text-utility-brand-700'
          : 'tw:border tw:border-utility-error-200 tw:bg-utility-error-50 tw:text-utility-error-700'
      )}>
      <span className="tw:font-medium tw:text-quaternary">{operatorLabel}</span>
      <span>{condition.value}</span>
    </span>
  );
}

export function ConditionChip({
  condition,
  operatorLabel,
  removeLabel,
  tone,
  onRemove,
}: Readonly<{
  condition: FilterCondition;
  operatorLabel: string;
  removeLabel: string;
  tone: 'exclude' | 'include';
  onRemove: () => void;
}>) {
  return (
    <span
      className={chipClass(tone)}
      data-testid={`${tone}-chip-${conditionKey(condition)}`}>
      <span
        className="filters-config-form__chip-operator tw:text-quaternary tw:font-medium"
        data-testid="label">
        {operatorLabel}
      </span>
      <span data-testid="value">{condition.value}</span>
      <Button
        aria-label={removeLabel}
        className="tw:inline-grid tw:size-4 tw:place-items-center"
        color="link-gray"
        data-testid="remove-button"
        size="xs"
        type="button"
        onPress={onRemove}>
        <XClose size={12} />
      </Button>
    </span>
  );
}
