import React, { KeyboardEventHandler, useState } from 'react';
import CreatableSelect from 'react-select/creatable';

const components = {
  DropdownIndicator: null,
};

interface Option {
  readonly label: string;
  readonly value: string;
}

type Props = {
  placeholder: string;
  getTagValue: (tags: Array<string>) => void;
};

const createOption = (label: string) => ({
  label,
  value: label,
});

const ReactSelectMultiInput = ({ placeholder, getTagValue }: Props) => {
  const [inputValue, setinputValue] = useState('');
  const [values, setValues] = useState<Option[]>([]);

  const handleInputChange = (inputValue: string) => {
    setinputValue(inputValue);
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
      value={values}
      onInputChange={handleInputChange}
      onKeyDown={handleKeyDown}
    />
  );
};

export default ReactSelectMultiInput;
