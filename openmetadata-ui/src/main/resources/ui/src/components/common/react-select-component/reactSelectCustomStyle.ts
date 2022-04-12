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
