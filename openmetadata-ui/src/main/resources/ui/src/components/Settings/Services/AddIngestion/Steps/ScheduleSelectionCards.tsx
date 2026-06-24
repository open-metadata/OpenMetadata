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

import { Card } from '@openmetadata/ui-core-components';
import { Check } from '@untitledui/icons';
import classNames from 'classnames';
import { FC } from 'react';
import { SelectionOption } from '../../../../common/SelectionCardGroup/SelectionCardGroup.interface';

export interface ScheduleSelectionCardsProps {
  options: SelectionOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

const ScheduleSelectionCards: FC<ScheduleSelectionCardsProps> = ({
  options,
  value,
  onChange,
  disabled = false,
}) => {
  const handleSelect = (selectedValue: string) => {
    if (!disabled) {
      onChange?.(selectedValue);
    }
  };

  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <Card
            className={classNames(
              'tw:flex tw:flex-col tw:gap-3 tw:p-4',
              disabled && 'tw:cursor-not-allowed tw:opacity-60'
            )}
            color={isSelected ? 'brand' : 'default'}
            data-testid={`schedular-${option.value}`}
            isClickable={!disabled}
            isSelected={isSelected}
            key={option.value}
            onClick={() => handleSelect(option.value)}>
            <div className="tw:flex tw:items-start tw:justify-between">
              <span
                className={classNames(
                  'tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-lg tw:[&_svg]:size-5',
                  isSelected
                    ? 'tw:bg-utility-brand-50 tw:text-brand-secondary'
                    : 'tw:bg-secondary tw:text-fg-quaternary'
                )}>
                {option.icon}
              </span>

              {isSelected ? (
                <span
                  className="tw:flex tw:size-5 tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-solid tw:text-white"
                  data-testid="selected-indicator">
                  <Check className="tw:size-3.5" />
                </span>
              ) : (
                <span
                  className="tw:size-5 tw:rounded-full tw:ring-1 tw:ring-primary tw:ring-inset"
                  data-testid="unselected-indicator"
                />
              )}
            </div>

            <div className="tw:flex tw:flex-col tw:gap-0.5">
              <div className="tw:text-sm tw:font-semibold tw:text-primary">
                {option.label}
              </div>
              <div className="tw:text-sm tw:text-tertiary">
                {option.description}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default ScheduleSelectionCards;
