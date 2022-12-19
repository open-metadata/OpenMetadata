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

import { Select, SelectProps, Tag } from 'antd';
import { isEmpty } from 'lodash';
import React, { useState } from 'react';

/**
 * AsyncSelect to work with options provided from API directly
 * Pass api reference or a function which can communicate with API and return with DefaultOptionType[]
 * Additional configuration can be provided once needed like: debounce value, defaultOptions etc
 * @param param0
 * @returns ReactComponent with select functionality
 */
export const CreatableSelect = (props: SelectProps) => {
  const [newOption, setNewOption] = useState('');

  return (
    <Select
      showSearch
      options={
        isEmpty(newOption) ? [] : [{ label: newOption, value: newOption }]
      }
      tagRender={(props) => {
        return <Tag {...props} />;
      }}
      onSearch={(value: string) => {
        setNewOption(value);
      }}
      {...props}
    />
  );
};
