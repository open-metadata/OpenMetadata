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
import { FilterSelect } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compact, debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DataProductsSelectListProps } from './DataProductSelectList.interface';

const DataProductsSelectList = ({
  selectedDataProducts,
  fetchOptions,
  multiple = true,
  isOpen,
  onOpenChange,
  onSubmit,
  children,
  debounceTimeout = 800,
}: DataProductsSelectListProps) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<DataProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Drops responses for a search or page the user has already moved past.
  const searchGeneration = useRef(0);
  // Scroll fires several times before a re-render, so the in-flight guard
  // can't wait for state.
  const isFetchingMore = useRef(false);
  // Every data product seen while open, so a pick made under an earlier
  // search still resolves to its entity on Apply.
  const knownDataProducts = useRef(new Map<string, DataProduct>());

  const remember = (dataProducts: DataProduct[]) =>
    dataProducts.forEach((dataProduct) =>
      knownDataProducts.current.set(
        dataProduct.fullyQualifiedName ?? '',
        dataProduct
      )
    );

  const loadFirstPage = useCallback(
    async (search: string, generation: number) => {
      try {
        const res = await fetchOptions(search, 1);
        if (generation !== searchGeneration.current) {
          return;
        }
        const dataProducts = res.data.map((option) => option.value);
        remember(dataProducts);
        setOptions(dataProducts);
        setTotal(res.paging.total);
        setPage(1);
        setSearchText(search);
      } catch (error) {
        if (generation === searchGeneration.current) {
          // Rows from the previous search must not read as this one's results.
          setOptions([]);
          setTotal(0);
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (generation === searchGeneration.current) {
          setIsLoading(false);
        }
      }
    },
    [fetchOptions]
  );

  const debouncedLoad = useMemo(
    () => debounce(loadFirstPage, debounceTimeout),
    [loadFirstPage, debounceTimeout]
  );

  const beginSearch = (search: string, immediate = false) => {
    const generation = ++searchGeneration.current;
    setIsLoading(true);
    setIsLoadingMore(false);
    isFetchingMore.current = false;
    debouncedLoad.cancel();
    if (immediate) {
      void loadFirstPage(search, generation);
    } else {
      debouncedLoad(search, generation);
    }
  };

  useEffect(() => {
    if (isOpen) {
      knownDataProducts.current.clear();
      beginSearch('', true);
    }

    return () => {
      ++searchGeneration.current;
      debouncedLoad.cancel();
    };
  }, [isOpen]);

  const handleLoadMore = async () => {
    if (isLoading || isFetchingMore.current || options.length >= total) {
      return;
    }
    const generation = searchGeneration.current;
    isFetchingMore.current = true;
    setIsLoadingMore(true);
    try {
      const res = await fetchOptions(searchText, page + 1);
      if (generation !== searchGeneration.current) {
        return;
      }
      const dataProducts = res.data.map((option) => option.value);
      remember(dataProducts);
      setOptions((prev) => [...prev, ...dataProducts]);
      setTotal(res.paging.total);
      setPage((prev) => prev + 1);
    } catch (error) {
      if (generation === searchGeneration.current) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (generation === searchGeneration.current) {
        isFetchingMore.current = false;
        setIsLoadingMore(false);
      }
    }
  };

  // The name, with its domain(s) muted underneath, as the picker always showed.
  const selectOptions = useMemo(
    () =>
      options.map((dataProduct) => {
        const name = getEntityName(dataProduct);
        const domains = dataProduct.domains
          ?.map((domain) => getEntityName(domain))
          .join(', ');

        return {
          value: dataProduct.fullyQualifiedName ?? '',
          textValue: name,
          label: (
            <span className="tw:flex tw:min-w-0 tw:flex-col">
              <span className="tw:truncate">{name}</span>
              {domains && (
                <span className="tw:truncate tw:text-xs tw:text-tertiary">
                  {domains}
                </span>
              )}
            </span>
          ),
        };
      }),
    [options]
  );

  const selectedValues = useMemo(
    () =>
      selectedDataProducts.map(
        (dataProduct) => dataProduct.fullyQualifiedName ?? ''
      ),
    [selectedDataProducts]
  );

  const findDataProduct = (fqn: string) =>
    knownDataProducts.current.get(fqn) ??
    (selectedDataProducts.find(
      (dataProduct) => dataProduct.fullyQualifiedName === fqn
    ) as DataProduct | undefined);

  const resolveLabel = (fqn: string) => {
    const dataProduct = findDataProduct(fqn);

    return dataProduct ? getEntityName(dataProduct) : fqn;
  };

  // Every value is a selected product or a row seen while open, so each resolves.
  const handleChange = (fqns: string[]) => {
    void onSubmit(compact(fqns.map(findDataProduct)));
  };

  return (
    <FilterSelect
      hideCounts
      searchable
      commitMode="staged"
      emptyState={t('label.no-entity-available', {
        entity: t('label.data-product-plural'),
      })}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      isOpen={isOpen}
      label={t('label.data-product-plural')}
      options={selectOptions}
      resolveMissingLabel={resolveLabel}
      selectedValues={selectedValues}
      selectionMode={multiple ? 'multiple' : 'single'}
      showRadio={!multiple}
      showSelectAll={multiple}
      trigger={children}
      onChange={handleChange}
      onLoadMore={handleLoadMore}
      onOpenChange={onOpenChange}
      onSearch={(search) => beginSearch(search)}
    />
  );
};

export default DataProductsSelectList;
