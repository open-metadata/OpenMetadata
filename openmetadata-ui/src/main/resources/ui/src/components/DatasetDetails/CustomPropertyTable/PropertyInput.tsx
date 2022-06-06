/*
 *  Copyright 2021 Collate
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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { ChangeEvent, FC, useState } from 'react';
import { Button } from '../../buttons/Button/Button';

interface PropertInputProps {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  value: any;
  type: string;
  propertyName: string;
  onCancel: () => void;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  onSave: (value: any) => void;
}

export const PropertyInput: FC<PropertInputProps> = ({
  value,
  onCancel,
  type,
  propertyName,
  onSave,
}) => {
  const inputType = type === 'string' ? 'text' : 'number';

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [inputValue, setInputValue] = useState<any>(value || '');

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value: updatedValue } = e.target;

    setInputValue(updatedValue);
  };

  const handleSave = () => {
    onSave(inputValue);
  };

  return (
    <div className="tw-flex tw-items-center tw-gap-1">
      <input
        className="tw-form-inputs tw-form-inputs-padding tw-py-0.5 tw-w-64"
        data-testid="value"
        id="value"
        name={propertyName}
        placeholder="value"
        type={inputType}
        value={inputValue}
        onChange={onChange}
      />
      <div className="tw-flex tw-justify-end" data-testid="buttons">
        <Button
          className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
          data-testid="cancel-value"
          size="custom"
          theme="primary"
          variant="contained"
          onMouseDown={onCancel}>
          <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="times" />
        </Button>
        <Button
          className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
          data-testid="save-value"
          size="custom"
          theme="primary"
          variant="contained"
          onClick={handleSave}>
          <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="check" />
        </Button>
      </div>
    </div>
  );
};
