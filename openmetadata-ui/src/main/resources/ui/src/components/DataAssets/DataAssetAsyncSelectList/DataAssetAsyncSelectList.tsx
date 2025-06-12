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
import { Select, SelectProps, Space } from 'antd';
import { AxiosError } from 'axios';
import { debounce, isArray, isString } from 'lodash';
import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { PAGE_SIZE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { usePaging } from '../../../hooks/paging/usePaging';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import {
  DataAssetAsyncSelectListProps,
  DataAssetOption,
  FetchOptionsResponse,
} from './DataAssetAsyncSelectList.interface';

const DataAssetAsyncSelectList: FC<DataAssetAsyncSelectListProps> = ({
  mode,
  autoFocus = true,
  onChange,
  debounceTimeout = 800,
  initialOptions,
  searchIndex = SearchIndex.ALL,
  value: selectedValue,
  filterFqns = [],
  ...props
}) => {
  const {
    currentPage,
    handlePagingChange,
    handlePageChange,
    paging,
    pageSize,
  } = usePaging(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const [hasContentLoading, setHasContentLoading] = useState(false);
  const [options, setOptions] = useState<DataAssetOption[]>(
    initialOptions ?? []
  );
  const [searchValue, setSearchValue] = useState<string>('');
  const selectedDataAssetsRef = useRef<DataAssetOption[]>(initialOptions ?? []);

  const fetchOptions = useCallback(
    async (
      searchQueryParam: string,
      page: number
    ): Promise<FetchOptionsResponse> => {
      const dataAssetsResponse = await searchQuery({
        query: searchQueryParam ? `*${searchQueryParam}*` : '*',
        pageNumber: page,
        pageSize: pageSize,
        searchIndex: searchIndex,
        // Filter out bots from user search
        queryFilter: {
          query: { bool: { must_not: [{ match: { isBot: true } }] } },
        },
      });

      const hits = dataAssetsResponse.hits.hits;
      const total = dataAssetsResponse.hits.total.value;

      const dataAssets = hits.map(({ _source }) => {
        const entityName = getEntityName(_source);
        const entityRef = getEntityReferenceFromEntity(
          _source as EntityReference,
          _source.entityType as EntityType
        );

        return {
          label: entityName,
          value: _source.fullyQualifiedName,
          reference: {
            ...entityRef,
          },
          displayName: entityName,
          name: _source.name,
        };
      });

      return {
        data: dataAssets,
        paging: {
          total,
        },
      };
    },
    [pageSize]
  );

  const loadOptions = useCallback(
    async (value: string) => {
      setOptions([]);
      setIsLoading(true);
      try {
        const res = await fetchOptions(value, 1);
        setOptions(res.data);
        handlePagingChange(res.paging);
        setSearchValue(value);
        handlePageChange(1);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchOptions, handlePagingChange, handlePageChange]
  );

  const optionList = useMemo(() => {
    return options
      .filter(
        (op) => !filterFqns.includes(op.reference.fullyQualifiedName ?? '')
      )
      .map((option) => {
        const { value, reference, displayName } = option;

        let label;
        if (
          searchIndex === SearchIndex.USER ||
          searchIndex === SearchIndex.TEAM ||
          reference.type === EntityType.USER ||
          reference.type === EntityType.TEAM
        ) {
          label = (
            <Space>
              <ProfilePicture
                className="d-flex"
                isTeam={reference.type === EntityType.TEAM}
                name={option.name ?? ''}
                type="circle"
                width="24"
              />
              <span className="m-l-xs" data-testid={getEntityName(option)}>
                {getEntityName(option)}
              </span>
            </Space>
          );
        } else {
          label = (
            <div
              className="d-flex items-center gap-2"
              data-testid={`option-${value}`}>
              <div className="flex-center data-asset-icon">
                {searchClassBase.getEntityIcon(reference.type)}
              </div>
              <div className="d-flex flex-col">
                <span className="text-grey-muted text-xs">
                  {reference.type}
                </span>
                <span className="font-medium truncate w-56">{displayName}</span>
              </div>
            </div>
          );
        }

        return { label, value, reference, displayName };
      });
  }, [options, searchIndex, filterFqns]);

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
          handlePagingChange(res.paging);
          handlePageChange((prev) => prev + 1);
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
    if (mode) {
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
    } else {
      onChange?.(options as DataAssetOption);
    }
  };

  const internalValue = useMemo(() => {
    if (isString(selectedValue) || isArray(selectedValue)) {
      return selectedValue as string | string[];
    }
    const selectedOption = selectedValue as DataAssetOption;

    return selectedOption?.value as string;
  }, [mode, selectedValue]);

  return (
    <Select
      allowClear
      showSearch
      autoFocus={autoFocus}
      data-testid="asset-select-list"
      dropdownRender={dropdownRender}
      filterOption={false}
      mode={mode}
      notFoundContent={isLoading ? <Loader size="small" /> : null}
      optionLabelProp="displayName"
      options={optionList}
      style={{ width: '100%' }}
      value={internalValue}
      onBlur={() => {
        handlePageChange(1);
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
