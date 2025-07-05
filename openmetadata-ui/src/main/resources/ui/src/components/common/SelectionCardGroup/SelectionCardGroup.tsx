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
import { CheckOutlined } from '@ant-design/icons';
import { Card } from 'antd';
import classNames from 'classnames';
import { FC } from 'react';
import './selection-card-group.less';
import {
  SelectionCardGroupProps,
  SelectionCardProps,
} from './SelectionCardGroup.interface';

const SelectionCard: FC<SelectionCardProps> = ({
  option,
  isSelected,
  onClick,
}: SelectionCardProps) => (
  <Card
    className={classNames('selection-card', {
      selected: isSelected,
    })}
    onClick={onClick}>
    <div className="selection-content">
      <div className="d-flex gap-4">
        <span className="selection-icon">{option.icon}</span>
        <div className="selection-header">
          <div className="selection-title">{option.label}</div>
          <div className="selection-description">{option.description}</div>
        </div>
      </div>
      {isSelected ? (
        <div className="custom-radio checked">
          <CheckOutlined />
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
}: SelectionCardGroupProps) => {
  const handleOptionSelect = (selectedValue: string) => {
    onChange?.(selectedValue);
  };

  return (
    <div className={classNames('selection-card-group', className)}>
      {options.map((option) => (
        <SelectionCard
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
