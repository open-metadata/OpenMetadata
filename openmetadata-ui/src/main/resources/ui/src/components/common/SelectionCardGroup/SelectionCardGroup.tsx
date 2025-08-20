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

import { Card } from 'antd';
import classNames from 'classnames';
import { FC } from 'react';
import CheckIcon from '../../../assets/svg/check-colored.svg?react';
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
}: SelectionCardProps) => (
  <Card
    className={classNames('selection-card', {
      selected: isSelected,
      disabled: disabled,
    })}
    style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
    onClick={disabled ? undefined : onClick}>
    <div className="selection-content">
      <div className="d-flex gap-3">
        <span className="selection-icon">{option.icon}</span>
        <div className="selection-header">
          <div className="selection-title">{option.label}</div>
          <div className="selection-description">{option.description}</div>
        </div>
      </div>
      {isSelected ? (
        <div className="custom-radio checked">
          <CheckIcon />
        </div>
      ) : (
        <div className="custom-radio unchecked" />
      )}
    </div>
  </Card>
);

const SelectionCardGroup: FC<SelectionCardGroupProps> = ({
  options,
  value,
  onChange,
  className,
  disabled = false,
}: SelectionCardGroupProps) => {
  const handleOptionSelect = (selectedValue: string) => {
    if (!disabled) {
      onChange?.(selectedValue);
    }
  };

  return (
    <div
      className={classNames('selection-card-group', className, {
        'selection-card-group-disabled': disabled,
      })}>
      {options.map((option) => (
        <SelectionCard
          disabled={disabled}
          isSelected={value === option.value}
          key={option.value}
          option={option}
          onClick={() => handleOptionSelect(option.value)}
        />
      ))}
    </div>
  );
};

export default SelectionCardGroup;
