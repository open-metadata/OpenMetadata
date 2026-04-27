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
import { Autocomplete, SelectItemType } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce, isArray, isString } from 'lodash';
import {
  FC,
  Key,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PAGE_SIZE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { Paging } from '../../../generated/type/paging';
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
  multiple = true,
  autoFocus = true,
  onChange,
  debounceTimeout = 800,
  initialOptions,
  searchIndex = SearchIndex.ALL,
  value: selectedValue,
  filterFqns = [],
  queryFilter,
  defaultValue,
  ...props
}) => {
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);
  const [options, setOptions] = useState<DataAssetOption[]>(
    initialOptions ?? []
  );
  const [selectedItems, setSelectedItems] = useState<DataAssetOption[]>(
    initialOptions ?? []
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchValue, setSearchValue] = useState<string>('');
  const hasInitiallyLoaded = useRef(false);
  // Tracks all options ever seen so selected items survive option list changes
  const knownOptionsRef = useRef<Map<string, DataAssetOption>>(
    new Map(initialOptions?.map((opt) => [opt.value, opt]) ?? [])
  );
  // Pending default values to resolve when options first load
  const pendingDefaultValues = useRef<string[] | null>(
    !initialOptions?.length && defaultValue?.length ? defaultValue : null
  );

  const defaultQueryFilter = useMemo(
    () => ({ query: { bool: { must_not: [{ match: { isBot: true } }] } } }),
    []
  );

  const fetchOptions = useCallback(
    async (
      searchQueryParam: string,
      page: number
    ): Promise<FetchOptionsResponse> => {
      const dataAssetsResponse = await searchQuery({
        query: searchQueryParam ? `*${searchQueryParam}*` : '*',
        pageNumber: page,
        pageSize: PAGE_SIZE,
        searchIndex: searchIndex,
        // Filter out bots from user search
        queryFilter: queryFilter ?? defaultQueryFilter,
      });

      const hits = dataAssetsResponse.hits.hits;
      const total = dataAssetsResponse.hits.total.value;

      const dataAssets = hits.map(({ _source }) => {
        const entityName = getEntityName(_source);
        const sourceType = (_source as { type?: string }).type as EntityType;
        const entityRef = getEntityReferenceFromEntity(
          _source as EntityReference,
          sourceType
        );

        return {
          id: entityRef.fullyQualifiedName,
          label: entityName,
          value: entityRef.fullyQualifiedName,
          reference: {
            ...entityRef,
          },
          displayName: entityName,
          name: entityRef.name,
          icon: searchClassBase.getEntityIcon(
            entityRef.type,
            'tw:text-sm tw:h-4'
          ) as ReactNode,
        };
      });

      return {
        data: dataAssets,
        paging: {
          total,
        },
      };
    },
    [searchIndex, queryFilter, defaultQueryFilter]
  );

  const loadOptions = useCallback(
    async (value: string) => {
      try {
        const res = await fetchOptions(value, 1);
        setOptions(res.data);
        setSearchValue(value);
        setPaging(res.paging);
        setCurrentPage(1);
        // Track all loaded options so selection survives option list changes
        res.data.forEach((opt) => knownOptionsRef.current.set(opt.value, opt));
        // Resolve any pending default values on first load
        if (pendingDefaultValues.current) {
          const defaultItems = res.data.filter((opt) =>
            pendingDefaultValues.current!.includes(opt.value)
          );
          if (defaultItems.length > 0) {
            setSelectedItems(defaultItems);
            pendingDefaultValues.current = null;
          }
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [fetchOptions]
  );

  const loadMoreOptions = useCallback(async () => {
    if (isLoadingMore || options.length >= paging.total) {
      return;
    }

    try {
      setIsLoadingMore(true);
      const res = await fetchOptions(searchValue, currentPage + 1);
      setOptions((prev) => [...prev, ...res.data]);
      setPaging(res.paging);
      setCurrentPage((prev) => prev + 1);
      res.data.forEach((opt) => knownOptionsRef.current.set(opt.value, opt));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    options.length,
    paging.total,
    fetchOptions,
    searchValue,
    currentPage,
  ]);

  const filteredOptions = useMemo(() => {
    return options.filter(
      (op) => !filterFqns.includes(op.reference.fullyQualifiedName ?? '')
    );
  }, [options, filterFqns]);

  const debouncedSearch = useMemo(
    () => debounce(loadOptions, debounceTimeout),
    [loadOptions, debounceTimeout]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const handleItemInserted = useCallback(
    (key: Key) => {
      const item = filteredOptions.find((opt) => opt.id === key);
      if (!item) {
        return;
      }

      if (multiple) {
        const updatedSelection = [...selectedItems, item];
        setSelectedItems(updatedSelection);
        onChange?.(updatedSelection);
      } else {
        setSelectedItems([item]);
        onChange?.(item);
      }
    },
    [filteredOptions, selectedItems, multiple, onChange]
  );

  const handleItemCleared = useCallback(
    (key: Key) => {
      const updatedSelection = selectedItems.filter(
        (item) => item.id !== key
      );
      setSelectedItems(updatedSelection);
      if (multiple) {
        onChange?.(updatedSelection);
      } else {
        onChange?.(updatedSelection[0] ?? null);
      }
    },
    [selectedItems, multiple, onChange]
  );

  useEffect(() => {
    if (!selectedValue) {
      return;
    }
    if (isArray(selectedValue)) {
      const arr = selectedValue as (string | DataAssetOption)[];
      if (arr.length === 0) {
        return;
      }
      if (isString(arr[0])) {
        // Array of FQN strings
        const items = (arr as string[])
          .map((val) => knownOptionsRef.current.get(val))
          .filter(Boolean) as DataAssetOption[];
        if (items.length > 0) {
          setSelectedItems(items);
        }
      } else {
        // Array of DataAssetOption objects
        setSelectedItems(arr as DataAssetOption[]);
      }
    } else if (isString(selectedValue)) {
      // Single FQN string
      const item = knownOptionsRef.current.get(selectedValue);
      if (item) {
        setSelectedItems([item]);
      }
    } else {
      // Single DataAssetOption object
      setSelectedItems([selectedValue as DataAssetOption]);
    }
  }, [selectedValue]);

  useEffect(() => {
    if (!hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      loadOptions('');
    }
  }, []);

  const customPopoverClassName = useMemo(() => {
    return `data-asset-async-select-popover ${props.popoverClassName ?? ''}`;
  }, [props.popoverClassName]);

  useEffect(() => {
    let currentPopover: HTMLDivElement | null = null;

    const handleNativeScroll = (e: Event) => {
      const target = e.currentTarget as HTMLDivElement;
      const scrollThreshold = 50;
      const isNearBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight <
        scrollThreshold;

      if (isNearBottom) {
        loadMoreOptions();
      }
    };

    const tryAttachScroll = (popover: HTMLDivElement | null) => {
      if (!popover || currentPopover === popover) {
        return;
      }
      if (currentPopover) {
        currentPopover.removeEventListener('scroll', handleNativeScroll);
      }
      currentPopover = popover;
      popover.addEventListener('scroll', handleNativeScroll);
    };

    // Attach immediately if popover already exists
    tryAttachScroll(
      document.querySelector(
        '.data-asset-async-select-popover'
      ) as HTMLDivElement | null
    );

    const observer = new MutationObserver(() => {
      tryAttachScroll(
        document.querySelector(
          '.data-asset-async-select-popover'
        ) as HTMLDivElement | null
      );
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (currentPopover) {
        currentPopover.removeEventListener('scroll', handleNativeScroll);
      }
    };
  }, [loadMoreOptions]);

  return (
    <Autocomplete
      autoFocus={autoFocus}
      data-testid="asset-select-list"
      items={filteredOptions}
      multiple={multiple}
      placeholder={props.placeholder}
      popoverClassName={customPopoverClassName}
      selectedItems={selectedItems}
      onItemCleared={handleItemCleared}
      onItemInserted={handleItemInserted}
      onSearchChange={handleSearchChange}
      {...props}>
      {(item: SelectItemType) => {
        const dataAssetItem = item as DataAssetOption;
        const { reference, displayName, name } = dataAssetItem;

        if (
          searchIndex === SearchIndex.USER ||
          searchIndex === SearchIndex.TEAM ||
          reference.type === EntityType.USER ||
          reference.type === EntityType.TEAM
        ) {
          return (
            <Autocomplete.Item
              data-testid={getEntityName(dataAssetItem)}
              id={item.id}
              key={item.id}
              label={getEntityName(dataAssetItem)}>
              <div className="tw:flex tw:items-center tw:gap-2">
                <ProfilePicture
                  className="d-flex"
                  isTeam={reference.type === EntityType.TEAM}
                  name={name ?? ''}
                  type="circle"
                  width="24"
                />
                <span data-testid={getEntityName(dataAssetItem)}>
                  {getEntityName(dataAssetItem)}
                </span>
              </div>
            </Autocomplete.Item>
          );
        }

        const isLastItem =
          filteredOptions[filteredOptions.length - 1]?.id === item.id;

        return (
          <Autocomplete.Item
            data-testid={`option-${item.id}`}
            icon={item.icon}
            id={item.id}
            key={item.id}
            label={displayName}
            supportingText={reference.type}>
            {isLoadingMore && isLastItem && (
              <div className="tw:flex tw:justify-center tw:p-2">
                <Loader size="small" />
              </div>
            )}
          </Autocomplete.Item>
        );
      }}
    </Autocomplete>
  );
};

export default DataAssetAsyncSelectList;
