/*
 *  Copyright 2026 Collate.
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
import {
  Badge,
  Button,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, Plus, SearchLg } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityIconWithBg } from 'src/utils/Assets/AssetsUtils';
import { PAGE_SIZE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { Paging } from '../../../generated/type/paging';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityReferenceUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  DataAssetAsyncSelectListProps,
  DataAssetOption,
  FetchOptionsResponse,
} from './DataAssetAsyncSelectList.interface';

const DataAssetSelectList: FC<DataAssetAsyncSelectListProps> = ({
  onChange,
  debounceTimeout = 800,
  initialOptions,
  searchIndex = SearchIndex.ALL,
  value: selectedValue,
  filterFqns = [],
  queryFilter,
  placeholder,
}) => {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isFetchingMore = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<DataAssetOption[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected] = useState<DataAssetOption[]>(
    initialOptions ?? []
  );

  useEffect(() => {
    if (Array.isArray(selectedValue)) {
      setSelected(selectedValue as DataAssetOption[]);
    } else if (selectedValue && typeof selectedValue === 'object') {
      setSelected([selectedValue]);
    }
  }, [selectedValue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const fetchOptions = useCallback(
    async (
      searchQueryParam: string,
      page: number
    ): Promise<FetchOptionsResponse> => {
      const response = await searchQuery({
        query: searchQueryParam ? `*${searchQueryParam}*` : '*',
        pageNumber: page,
        pageSize: PAGE_SIZE,
        searchIndex,
        queryFilter: queryFilter ?? {
          query: { bool: { must_not: [{ match: { isBot: true } }] } },
        },
      });

      const hits = response.hits.hits;
      const total = response.hits.total.value;

      const data = hits.map(({ _source }) => {
        const entityName = getEntityName(_source);
        const entityRef = getEntityReferenceFromEntity(
          _source as EntityReference,
          _source.entityType as EntityType
        );

        return {
          label: entityName,
          value: _source.fullyQualifiedName,
          reference: { ...entityRef },
          displayName: entityName,
          name: _source.name,
        };
      });

      return { data, paging: { total } };
    },
    [searchIndex, queryFilter]
  );

  const loadOptions = useCallback(
    async (query: string) => {
      setOptions([]);
      setIsLoading(true);
      try {
        const res = await fetchOptions(query, 1);
        setOptions(res.data);
        setSearchText(query);
        setPaging(res.paging);
        setCurrentPage(1);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchOptions]
  );

  const debouncedLoad = useMemo(
    () => debounce((q: string) => loadOptions(q), debounceTimeout),
    [loadOptions, debounceTimeout]
  );

  useEffect(() => {
    if (!isOpen) {
      debouncedLoad.cancel();
    }

    return () => {
      debouncedLoad.cancel();
    };
  }, [debouncedLoad, isOpen]);

  const selectedFqns = useMemo(
    () => new Set(selected.map((o) => String(o.value ?? ''))),
    [selected]
  );

  const visibleOptions = useMemo(
    () =>
      options.filter(
        (op) => !filterFqns.includes(op.reference.fullyQualifiedName ?? '')
      ),
    [options, filterFqns]
  );

  const handleToggle = useCallback(
    (opt: DataAssetOption) => {
      const fqn = String(opt.value ?? '');
      const isSelected = selectedFqns.has(fqn);
      const next = isSelected
        ? selected.filter((o) => String(o.value ?? '') !== fqn)
        : [...selected, opt];
      setSelected(next);
      onChange?.(next);
    },
    [selected, selectedFqns, onChange]
  );

  const handleScroll = useCallback(
    async (e: React.UIEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollTop + el.offsetHeight >= el.scrollHeight - 20;
      if (
        nearBottom &&
        options.length < (paging.total ?? 0) &&
        !isFetchingMore.current
      ) {
        isFetchingMore.current = true;
        try {
          const res = await fetchOptions(searchText, currentPage + 1);
          setOptions((prev) => [...prev, ...res.data]);
          setPaging(res.paging);
          setCurrentPage((prev) => prev + 1);
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          isFetchingMore.current = false;
        }
      }
    },
    [options.length, paging.total, searchText, currentPage, fetchOptions]
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    loadOptions('');
  }, [loadOptions]);

  return (
    <div className="tw:relative" ref={wrapperRef}>
      <Button
        color="secondary"
        iconLeading={Plus}
        size="sm"
        onPress={handleOpen}>
        {t('label.link-an-entity', { entity: t('label.asset') })}
      </Button>

      {isOpen && (
        <div className="tw:absolute tw:-top-76 tw:left-1 tw:mt-1 tw:z-50 tw:w-[95%] tw:rounded-lg tw:bg-white tw:shadow-lg tw:ring-1 tw:ring-gray-200 tw:overflow-hidden tw:h-74">
          <div className="tw:flex tw:flex-col">
            <div className="tw:p-2 tw:border-b tw:border-gray-100">
              <Input
                autoFocus
                className="tw:w-full"
                icon={SearchLg}
                placeholder={
                  placeholder ??
                  t('label.search-entity', { entity: t('label.asset-plural') })
                }
                value={searchText}
                onChange={(value) => {
                  setSearchText(value);
                  debouncedLoad(value);
                }}
              />
            </div>

            <div
              className="tw:overflow-y-auto tw:max-h-60"
              onScroll={handleScroll}>
              {isLoading && (
                <div className="tw:flex tw:items-center tw:justify-center tw:py-4">
                  <Typography className="tw:text-gray-400" size="text-sm">
                    {t('label.loading')}
                  </Typography>
                </div>
              )}
              {!isLoading && visibleOptions.length === 0 && (
                <div className="tw:flex tw:items-center tw:justify-center tw:py-4">
                  <Typography className="tw:text-gray-400" size="text-sm">
                    {t('label.no-data-found')}
                  </Typography>
                </div>
              )}
              {!isLoading &&
                visibleOptions.map((opt) => {
                  const { reference, displayName } = opt;
                  const fqn = String(opt.value ?? '');
                  const isSelected = selectedFqns.has(fqn);

                  return (
                    <button
                      className={[
                        'tw:w-full tw:flex tw:items-center tw:gap-2 tw:px-3 tw:py-2',
                        'tw:cursor-pointer tw:text-left tw:transition tw:duration-100',
                        'hover:tw:bg-gray-50 tw:outline-hidden',
                        isSelected ? 'tw:bg-blue-50' : '',
                      ].join(' ')}
                      key={fqn}
                      type="button"
                      onClick={() => handleToggle(opt)}>
                      {getEntityIconWithBg(reference.type)}

                      <div className="tw:flex tw:flex-1 tw:justify-between tw:items-center">
                        <div className="tw:max-w-75">
                          <Typography
                            ellipsis
                            className="tw:truncate tw:text-gray-800"
                            size="text-xs"
                            weight="medium">
                            {displayName}
                          </Typography>
                          <Typography
                            ellipsis
                            className="tw:text-gray-400 tw:truncate"
                            size="text-xs">
                            {reference.fullyQualifiedName ?? ''}
                          </Typography>
                        </div>
                        {reference.type && (
                          <Badge
                            className="tw:shrink-0 tw:capitalize tw:font-medium"
                            color="gray"
                            size="sm"
                            type="color">
                            {reference.type}
                          </Badge>
                        )}
                      </div>
                      {isSelected && (
                        <Check
                          className="tw:shrink-0 tw:text-blue-600"
                          size={16}
                          strokeWidth={2.5}
                        />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataAssetSelectList;
