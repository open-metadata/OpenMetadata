import React, { CSSProperties } from 'react';

export const dropdownIcon = ({ style }: { style?: CSSProperties }) => {
  return (
    <svg
      aria-hidden="true"
      className="tw-inline-block  tw-h-5 tw-w-5"
      fill="currentColor"
      style={style}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg">
      <path
        clipRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1
        0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        fillRule="evenodd"
      />
    </svg>
  );
};
