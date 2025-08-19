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

import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { debounce, isObject } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { Paging } from '../../../generated/type/paging';
import { showErrorToast } from '../../../utils/ToastUtils';
import { Select, SelectProps } from '../AntdCompat';
import Loader from '../Loader/Loader';
import { AsyncSelectListProps } from './AsyncSelectList.interface';
;

// Interface for paginated API response
export interface PagingResponse<T> {
  data: T;
  paging: Paging;
}

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
  enableInfiniteScroll = false,
  debounceTimeout = 400,
  ...restProps
}: SelectProps & AsyncSelectListProps) => {
  const [optionsInternal, setOptionsInternal] = useState<DefaultOptionType[]>();
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [hasContentLoading, setHasContentLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setOptionsInternal(options);
  }, [options]);

  const fetchOptions = useCallback(
    debounce(async (value: string, page = 1) => {
      if (page === 1) {
        setLoadingOptions(true);
        setOptionsInternal([]);
      } else {
        setHasContentLoading(true);
      }

      try {
        const response = await api(
          value,
          enableInfiniteScroll ? page : undefined
        );

        if (
          enableInfiniteScroll &&
          response &&
          isObject(response) &&
          'data' in response
        ) {
          // Handle paginated response
          const pagingResponse = response as PagingResponse<
            DefaultOptionType[]
          >;
          if (page === 1) {
            setOptionsInternal(pagingResponse.data);
            setPaging(pagingResponse.paging);
            setCurrentPage(1);
          } else {
            setOptionsInternal((prev) => [
              ...(prev || []),
              ...pagingResponse.data,
            ]);
            setPaging(pagingResponse.paging);
            setCurrentPage(page);
          }
        } else {
          // Handle simple array response
          const simpleResponse = response as DefaultOptionType[];
          setOptionsInternal(simpleResponse);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoadingOptions(false);
        setHasContentLoading(false);
      }
    }, debounceTimeout),
    [api, enableInfiniteScroll, debounceTimeout]
  );

  const handleSelection = useCallback(() => {
    setSearchText('');
  }, []);

  const onScroll = useCallback(
    async (e: React.UIEvent<HTMLDivElement>) => {
      if (!enableInfiniteScroll) {
        return;
      }

      const { currentTarget } = e;
      if (
        currentTarget.scrollTop + currentTarget.offsetHeight ===
        currentTarget.scrollHeight
      ) {
        const currentOptionsLength = optionsInternal?.length ?? 0;
        if (currentOptionsLength < paging.total && !hasContentLoading) {
          await fetchOptions(searchText, currentPage + 1);
        }
      }
    },
    [
      enableInfiniteScroll,
      optionsInternal,
      paging.total,
      hasContentLoading,
      searchText,
      currentPage,
      fetchOptions,
    ]
  );

  const dropdownRender = useCallback(
    (menu: React.ReactElement) => (
      <>
        {menu}
        {hasContentLoading && <Loader size="small" />}
      </>
    ),
    [hasContentLoading]
  );

  useEffect(() => {
    if (!restProps.disabled) {
      fetchOptions(searchText, 1);
    }
  }, [searchText, restProps.disabled]);

  return (
    <Select
      dropdownRender={enableInfiniteScroll ? dropdownRender : undefined}
      filterOption={false}
      notFoundContent={loadingOptions ? <Loader size="small" /> : null}
      options={optionsInternal}
      searchValue={searchText}
      suffixIcon={loadingOptions && <Loader size="small" />}
      onPopupScroll={enableInfiniteScroll ? onScroll : undefined}
      onSearch={(value: string) => {
        setSearchText(value);
        setCurrentPage(1);
      }}
      onSelect={handleSelection}
      {...restProps}
    />
  );
};
