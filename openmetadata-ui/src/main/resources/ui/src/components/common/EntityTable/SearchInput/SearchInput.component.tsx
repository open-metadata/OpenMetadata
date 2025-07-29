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
import { Input } from 'antd';
import React from 'react';
import { ReactComponent as SearchIcon } from '../../../../assets/svg/ic-input-search.svg';
import { SearchInputProps } from './SearchInput.interface';

import './search-input.less';

/**
 * Reusable search input for EntityTable and EntityTableFilter
 */
export function SearchInput({
  value,
  onChange,
  onKeyDown,
  placeholder = 'Search',
  variant = 'default',
  className = '',
  allowClear = true,
  style = {},
  ...rest
}: SearchInputProps) {
  const variantClass =
    variant === 'header' ? 'entity-search-input--header' : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
    onKeyDown?.(e);
  };

  return (
    <Input
      allowClear={allowClear}
      className={`entity-search-input ${variantClass} ${className}`.trim()}
      placeholder={placeholder}
      prefix={<SearchIcon style={{ fontSize: 16, color: '#363636' }} />}
      style={style}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );
}

export default SearchInput;
