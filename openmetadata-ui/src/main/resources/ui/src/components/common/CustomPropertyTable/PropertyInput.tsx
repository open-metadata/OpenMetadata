/*
 *  Copyright 2022 Collate.
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

import { Input } from 'antd';
import { ChangeEvent, FC, useState } from 'react';
import InlineEdit from '../InlineEdit/InlineEdit.component';

export interface PropertyInputProps {
  isLoading: boolean;
  value: string | number;
  type: 'text' | 'number';
  propertyName: string;
  onCancel: () => void;
  onSave: (value: string | number) => Promise<void>;
}

export const PropertyInput: FC<PropertyInputProps> = ({
  value,
  onCancel,
  type,
  propertyName,
  onSave,
  isLoading,
}: PropertyInputProps) => {
  const [inputValue, setInputValue] = useState<string | number>(value);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value: updatedValue } = e.target;

    setInputValue(updatedValue);
  };

  const handleSave = async () => {
    await onSave(inputValue);
  };

  return (
    <InlineEdit isLoading={isLoading} onCancel={onCancel} onSave={handleSave}>
      <Input
        allowClear
        className="w-full"
        data-testid="value-input"
        id="value"
        name={propertyName}
        placeholder="value"
        type={type}
        value={inputValue}
        onChange={onChange}
      />
    </InlineEdit>
  );
};
