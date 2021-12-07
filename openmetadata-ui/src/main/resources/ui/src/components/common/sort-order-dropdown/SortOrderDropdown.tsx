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

import PropTypes from 'prop-types';
import React from 'react';
import { stringToSlug } from '../../../utils/StringsUtils';

type SortOrderDropdownProps = {
  onChange: Function;
  options: Array<string>;
  slugString?: string;
};

const SortOrderDropdown: React.FC<SortOrderDropdownProps> = ({
  onChange,
  options,
  slugString,
}): React.ReactElement => {
  const handleOptionChange: React.ChangeEventHandler<HTMLSelectElement> = (
    e
  ) => {
    onChange(e.target.value);
  };

  return (
    <div className="tw-relative tw-inline-flex tw-ml-3">
      <svg
        className="tw-w-2 tw-h-2 tw-absolute tw-top-0 tw-right-0 tw-m-4 tw-pointer-events-none"
        viewBox="0 0 412 232"
        xmlns="http://www.w3.org/2000/svg">
        <path
          d="M206 171.144L42.678 7.822c-9.763-9.763-25.592-9.763-35.355 0-9.763 9.764-9.763 
          25.592 0 35.355l181 181c4.88 4.882 11.279 7.323 17.677 7.323s12.796-2.441 17.678-7.322l181-181c9.763-9.764 
          9.763-25.592 0-35.355-9.763-9.763-25.592-9.763-35.355 0L206 171.144z"
          fill="#648299"
          fillRule="nonzero"
        />
      </svg>
      <select
        className="tw-border tw-border-gray-300 tw-rounded tw-text-gray-600 tw-h-10 tw-pl-3 tw-pr-7 tw-bg-white hover:tw-border-gray-400 focus:tw-outline-none tw-appearance-none"
        data-testid="dropdown-container"
        onChange={handleOptionChange}>
        {options.map((option, index) => {
          return (
            <option
              data-testid="dropdown-option"
              key={index}
              value={stringToSlug(option, slugString)}>
              {option}
            </option>
          );
        })}
      </select>
    </div>
  );
};

SortOrderDropdown.propTypes = {
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
  slugString: PropTypes.string,
};

export default SortOrderDropdown;
