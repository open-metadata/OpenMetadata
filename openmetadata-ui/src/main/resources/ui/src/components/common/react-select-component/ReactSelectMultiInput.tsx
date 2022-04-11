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

import { isUndefined } from 'lodash';
import React, { KeyboardEventHandler, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { reactSelectCustomStyle } from './reactSelectCustomStyle';

const components = {
  DropdownIndicator: null,
};

interface Option {
  readonly label: string;
  readonly value: string;
}

type Props = {
  placeholder: string;
  initialData?: Array<string>;
  getTagValue: (tags: Array<string>) => void;
};

const createOption = (label: string) => ({
  label,
  value: label,
});

const getInitialValue = (data?: Array<string>) => {
  return isUndefined(data) ? [] : data.map((d) => createOption(d));
};

const ReactSelectMultiInput = ({
  placeholder,
  getTagValue,
  initialData,
}: Props) => {
  const [inputValue, setinputValue] = useState('');
  const [values, setValues] = useState<Option[]>(getInitialValue(initialData));

  const handleInputChange = (input: string) => {
    setinputValue(input);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!inputValue) return;
    switch (event.key) {
      case 'Enter':
      case 'Tab': {
        const newValues = [...values, createOption(inputValue)];
        setinputValue('');
        setValues(newValues);
        getTagValue(newValues.map((v) => v.value));
        event.preventDefault();
      }
    }
  };

  return (
    <CreatableSelect
      isClearable
      isMulti
      components={components}
      inputValue={inputValue}
      menuIsOpen={false}
      placeholder={placeholder}
      styles={reactSelectCustomStyle}
      value={values}
      onInputChange={handleInputChange}
      onKeyDown={handleKeyDown}
    />
  );
};

export default ReactSelectMultiInput;
