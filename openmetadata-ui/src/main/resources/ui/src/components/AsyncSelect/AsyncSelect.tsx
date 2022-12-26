/*
 *  Copyright 2022 Collate.
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

import { Select, SelectProps } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { debounce } from 'lodash';
import React, { useEffect, useState } from 'react';
import Loader from '../Loader/Loader';

/**
 * AsyncSelect to work with options provided from API directly
 * Pass api reference or a function which can communicate with API and return with DefaultOptionType[]
 * Additional configuration can be provided once needed like: debounce value, defaultOptions etc
 * @param param0
 * @returns ReactComponent with select functionality
 */
export const AsyncSelect = ({
  options,
  api,
  ...restProps
}: SelectProps & {
  api: (queryString: string) => Promise<DefaultOptionType[]>;
}) => {
  const [optionsInternal, setOptionsInternal] = useState<DefaultOptionType[]>();
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    setOptionsInternal(options);
  }, [options]);

  const fetchOptions = debounce((value: string) => {
    setLoadingOptions(true);
    api(value).then((res) => {
      setOptionsInternal(res);
      setLoadingOptions(false);
    });
  }, 300);

  return (
    <Select
      filterOption={false}
      notFoundContent={loadingOptions ? <Loader size="small" /> : null}
      options={optionsInternal}
      suffixIcon={<Loader size="small" />}
      onSearch={(value: string) => {
        fetchOptions(value);
        setLoadingOptions(true);
      }}
      {...restProps}
    />
  );
};
