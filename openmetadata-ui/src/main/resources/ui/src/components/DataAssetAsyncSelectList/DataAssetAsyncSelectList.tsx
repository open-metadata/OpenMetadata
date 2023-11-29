/*
 *  Copyright 2023 Collate.
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
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import React, { FC, useCallback, useMemo, useRef, useState } from 'react';
import Loader from '../../components/Loader/Loader';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/entity/type';
import { Paging } from '../../generated/type/paging';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export interface DataAssetOption extends DefaultOptionType {
  reference: EntityReference;
  displayName: string;
}

export interface DataAssetAsyncSelectListProps {
  mode?: 'multiple';
  className?: string;
  placeholder?: string;
  debounceTimeout?: number;
  defaultValue?: string[];
  initialOptions?: DataAssetOption[];
  onChange?: (option: DataAssetOption | DataAssetOption[]) => void;
}

interface FetchOptionsResponse {
  data: DataAssetOption[];
  paging: Paging;
}

const DataAssetAsyncSelectList: FC<DataAssetAsyncSelectListProps> = ({
  mode,
  onChange,
  debounceTimeout = 800,
  initialOptions,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasContentLoading, setHasContentLoading] = useState(false);
  const [options, setOptions] = useState<DataAssetOption[]>(
    initialOptions ?? []
  );
  const [searchValue, setSearchValue] = useState<string>('');
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);
  const selectedDataAssetsRef = useRef<DataAssetOption[]>(initialOptions ?? []);

  const fetchOptions = useCallback(
    async (
      searchQueryParam: string,
      page: number
    ): Promise<FetchOptionsResponse> => {
      const dataAssetsResponse = await searchQuery({
        query: searchQueryParam ? `*${searchQueryParam}*` : '*',
        pageNumber: page,
        pageSize: 10,
        queryFilter: {},
        searchIndex: SearchIndex.ALL,
      });

      const hits = dataAssetsResponse.hits.hits;
      const total = dataAssetsResponse.hits.total.value;

      const dataAssets = hits.map(({ _source }) => {
        const entityName = getEntityName(_source);

        return {
          label: entityName,
          value: _source.id,
          reference: {
            id: _source.id,
            type: _source.entityType,
          },
          displayName: entityName,
        };
      });

      return {
        data: dataAssets,
        paging: {
          total,
        },
      };
    },
    []
  );

  const loadOptions = useCallback(
    async (value: string) => {
      setOptions([]);
      setIsLoading(true);
      try {
        const res = await fetchOptions(value, 1);
        setOptions(res.data);
        setPaging(res.paging);
        setSearchValue(value);
        setCurrentPage(1);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchOptions]
  );

  const optionList = useMemo(() => {
    return options.map((option) => {
      const label = (
        <div
          className="d-flex items-center gap-2"
          data-testid={`option-${option.value}`}>
          <div className="flex-center">
            {getEntityIcon(option.reference.type)}
          </div>
          <div className="d-flex flex-col">
            <span className="text-grey-muted text-xs">
              {option.reference.type}
            </span>
            <span className="font-medium truncate w-56">
              {option.displayName}
            </span>
          </div>
        </div>
      );

      return {
        label,
        value: option.value,
        reference: option.reference,
        displayName: option.displayName,
      };
    });
  }, [options]);

  const debounceFetcher = useMemo(
    () => debounce(loadOptions, debounceTimeout),
    [loadOptions, debounceTimeout]
  );

  const onScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { currentTarget } = e;
    if (
      currentTarget.scrollTop + currentTarget.offsetHeight ===
      currentTarget.scrollHeight
    ) {
      if (options.length < paging.total) {
        try {
          setHasContentLoading(true);
          const res = await fetchOptions(searchValue, currentPage + 1);
          setOptions((prev) => [...prev, ...res.data]);
          setPaging(res.paging);
          setCurrentPage((prev) => prev + 1);
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setHasContentLoading(false);
        }
      }
    }
  };

  const dropdownRender = (menu: React.ReactElement) => (
    <>
      {menu}
      {hasContentLoading ? <Loader size="small" /> : null}
    </>
  );

  const handleChange: SelectProps['onChange'] = (values: string[], options) => {
    const selectedOptions = (options as DataAssetOption[]).reduce(
      (acc, option) => {
        if (values.includes(option.value as string)) {
          acc.push({ ...option, label: option.displayName });
        }

        return acc;
      },
      [] as DataAssetOption[]
    );

    selectedDataAssetsRef.current = selectedOptions;
    onChange?.(selectedOptions);
  };

  return (
    <Select
      autoFocus
      showSearch
      data-testid="asset-select-list"
      dropdownRender={dropdownRender}
      filterOption={false}
      mode={mode}
      notFoundContent={isLoading ? <Loader size="small" /> : null}
      optionLabelProp="displayName"
      options={optionList}
      style={{ width: '100%' }}
      onBlur={() => {
        setCurrentPage(1);
        setSearchValue('');
        setOptions([]);
      }}
      onChange={handleChange}
      onFocus={() => loadOptions('')}
      onPopupScroll={onScroll}
      onSearch={debounceFetcher}
      {...props}
    />
  );
};

export default DataAssetAsyncSelectList;
