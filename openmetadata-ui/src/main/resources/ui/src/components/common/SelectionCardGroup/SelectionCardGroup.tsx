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

import { Box, Card } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FC, KeyboardEvent } from 'react';
import { ReactComponent as CheckIcon } from '../../../assets/svg/check-colored.svg';
import { BetaBadge } from '../Badge/Badge.component';
import './selection-card-group.less';
import {
  SelectionCardGroupProps,
  SelectionCardProps,
} from './SelectionCardGroup.interface';

export const SelectionCard: FC<SelectionCardProps> = ({
  option,
  isSelected,
  onClick,
  disabled = false,
  layout = 'horizontal',
}: SelectionCardProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      aria-checked={isSelected}
      aria-disabled={disabled}
      className={classNames('selection-card', `selection-card-${layout}`, {
        selected: isSelected,
        disabled: disabled,
        'has-beta': option.isBeta,
      })}
      role="radio"
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}>
      {option.isBeta && <BetaBadge />}
      <Box
        align={layout === 'vertical' ? 'start' : 'stretch'}
        className="selection-content"
        justify="between">
        <Box
          className="selection-body"
          direction={layout === 'vertical' ? 'col' : 'row'}
          gap={3}>
          <span className="selection-icon">{option.icon}</span>
          <div className="selection-header">
            <div className="selection-title">{option.label}</div>
            <div className="selection-description">{option.description}</div>
          </div>
        </Box>
        {isSelected ? (
          <div className="custom-radio checked">
            <CheckIcon />
          </div>
        ) : (
          <div className="custom-radio unchecked" />
        )}
      </Box>
    </Card>
  );
};

const SelectionCardGroup: FC<SelectionCardGroupProps> = ({
  options,
  value,
  onChange,
  className,
  onClick,
  disabled = false,
  layout = 'horizontal',
}: SelectionCardGroupProps) => {
  const handleOptionSelect = (selectedValue: string) => {
    if (!disabled) {
      onChange?.(selectedValue);
      onClick?.();
    }
  };

  return (
    <Box
      className={classNames('selection-card-group', className, {
        'selection-card-group-disabled': disabled,
      })}
      gap={5}
      role="radiogroup">
      {options.map((option) => (
        <SelectionCard
          disabled={disabled}
          isSelected={value === option.value}
          key={option.value}
          layout={layout}
          option={option}
          onClick={() => handleOptionSelect(option.value)}
        />
      ))}
    </Box>
  );
};

export default SelectionCardGroup;
