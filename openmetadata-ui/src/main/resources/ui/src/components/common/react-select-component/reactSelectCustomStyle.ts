/*
 *  Copyright 2022 Collate
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
import { StylesConfig } from 'react-select';

const primeryColor = '#7147E8';
const bodyTextColor = '#37352F';
const borderColor = '#7046e8';

export const reactSelectCustomStyle: StylesConfig = {
  control: (styles, { isFocused }) => ({
    ...styles,
    backgroundColor: 'white',
    boxShadow: 'none',
    borderColor: isFocused ? primeryColor : 'none',
    ':hover': {
      border: `1px solid ${primeryColor}`,
    },
    ':focus': {
      border: `1px solid ${primeryColor}`,
    },
    minHeight: '31px',
  }),
  multiValue: (styles) => {
    return {
      ...styles,
      paddingRight: '4px',
      paddingLeft: '4px',
      borderRadius: '20px',
      border: `1px solid ${borderColor}`,
      backgroundColor: 'rgba(113, 71, 232, 0.1)',
    };
  },
  multiValueLabel: (styles) => ({
    ...styles,
    color: primeryColor,
  }),
  multiValueRemove: (styles) => ({
    ...styles,
    color: bodyTextColor,
    ':hover': {
      backgroundColor: 'none',
      color: bodyTextColor,
      cursor: 'pointer',
    },
  }),
};

export const reactSingleSelectCustomStyle: StylesConfig = {
  control: (styles, { isFocused }) => ({
    ...styles,
    backgroundColor: '#ffffff',
    boxShadow: 'none',
    borderColor: isFocused ? primeryColor : 'none',
    ':hover': {
      border: `1px solid ${primeryColor}`,
    },
    ':focus': {
      border: `1px solid ${primeryColor}`,
    },
    minWidth: '120px',
    minHeight: '31px',
  }),
  input: (styles) => ({
    ...styles,
    marginTop: 0,
    marginBottom: 0,
  }),
  option: (styles, { isSelected }) => ({
    ...styles,
    background: isSelected ? `#DBD1F9` : '#ffffff',
    color: `${bodyTextColor}`,
  }),
};
