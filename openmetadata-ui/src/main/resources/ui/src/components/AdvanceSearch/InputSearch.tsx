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

import React, { FC } from 'react';

interface InputSearchProp {
  searchValue: string;
  placeholder: string;
  handleOnBlur: () => void;
  handleOnFocus: () => void;
  handleSearchChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const InputSearch: FC<InputSearchProp> = ({
  searchValue,
  handleOnBlur,
  handleOnFocus,
  handleSearchChange,
  handleKeyDown,
  placeholder,
}) => {
  return (
    <input
      autoComplete="off"
      className="focus:tw-outline-none tw-pl-2 tw-pt-2 tw-pb-1.5 tw-w-full tw-bg-gray-50"
      data-testid="searchBox"
      id="searchBox"
      placeholder={placeholder}
      type="text"
      value={searchValue}
      onBlur={handleOnBlur}
      onChange={(e) => {
        handleSearchChange(e.target.value);
      }}
      onFocus={handleOnFocus}
      onKeyDown={handleKeyDown}
    />
  );
};

export default InputSearch;
