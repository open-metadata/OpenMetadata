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

import { Button, Dropdown, Typography } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { Key } from 'react-aria';
import { useTranslation } from 'react-i18next';
import { useQuickFiltersWithComponent } from '../../../../components/common/atoms/filters/useQuickFiltersWithComponent';
import { ExploreQuickFilterField } from '../../../../components/Explore/ExplorePage.interface';
import { AssetsOfEntity } from '../../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchIndex } from '../../../../enums/search.enum';
import { Aggregations } from '../../../../interface/search.interface';
import {
  ADDITIONAL_FILTER_KEYS,
  COLUMN_GRID_FILTERS,
  DEFAULT_VISIBLE_FILTER_KEYS,
} from '../constants/ColumnGrid.constants';

interface UseColumnGridFiltersConfig {
  aggregations?: Aggregations;
  parsedFilters?: ExploreQuickFilterField[];
  onFilterChange: (filters: ExploreQuickFilterField[]) => void;
}

interface UseColumnGridFiltersReturn {
  filterSection: ReactNode;
  defaultFilters: ExploreQuickFilterField[];
}

const COLUMN_SEARCH_INDEXES = [
  SearchIndex.TABLE,
  SearchIndex.DASHBOARD_DATA_MODEL,
  SearchIndex.TOPIC,
  SearchIndex.CONTAINER,
  SearchIndex.SEARCH_INDEX,
] as SearchIndex[];

export const useColumnGridFilters = (
  config: UseColumnGridFiltersConfig
): UseColumnGridFiltersReturn => {
  const { aggregations, parsedFilters, onFilterChange } = config;
  const { t } = useTranslation();

  const [addedFilterKeys, setAddedFilterKeys] = useState<Set<string>>(
    new Set()
  );

  const activeAdditionalKeys = useMemo(() => {
    if (!parsedFilters) {
      return new Set<string>();
    }

    return new Set(
      parsedFilters
        .filter(
          (pf) =>
            ADDITIONAL_FILTER_KEYS.includes(pf.key) &&
            pf.value &&
            pf.value.length > 0
        )
        .map((pf) => pf.key)
    );
  }, [parsedFilters]);

  useEffect(() => {
    if (activeAdditionalKeys.size > 0) {
      setAddedFilterKeys((prev) => {
        const next = new Set(prev);
        activeAdditionalKeys.forEach((key) => next.add(key));

        return next;
      });
    }
  }, [activeAdditionalKeys]);

  const visibleFilterKeys = useMemo(() => {
    return new Set([
      ...DEFAULT_VISIBLE_FILTER_KEYS,
      ...addedFilterKeys,
      ...activeAdditionalKeys,
    ]);
  }, [addedFilterKeys, activeAdditionalKeys]);

  const visibleFilters = useMemo(() => {
    const defaultFilters = COLUMN_GRID_FILTERS.filter((f) =>
      DEFAULT_VISIBLE_FILTER_KEYS.includes(f.key)
    );
    const addedFilters = COLUMN_GRID_FILTERS.filter(
      (f) =>
        !DEFAULT_VISIBLE_FILTER_KEYS.includes(f.key) &&
        visibleFilterKeys.has(f.key)
    );

    return [...defaultFilters, ...addedFilters];
  }, [visibleFilterKeys]);

  const remainingFilters = useMemo(
    () => COLUMN_GRID_FILTERS.filter((f) => !visibleFilterKeys.has(f.key)),
    [visibleFilterKeys]
  );

  const handleAddFilter = useCallback((filterKey: string) => {
    setAddedFilterKeys((prev) => new Set([...prev, filterKey]));
  }, []);

  const addFilterButton = useMemo(() => {
    if (remainingFilters.length === 0) {
      return null;
    }

    return (
      <Typography as="span" className="tw:inline-flex tw:items-center tw:h-8">
        <Dropdown.Root>
          <Button color="tertiary" iconLeading={Plus} size="sm">
            {t('label.add-entity', { entity: t('label.filter') })}
          </Button>
          <Dropdown.Popover className="tw:w-auto">
            <Dropdown.Menu
              disallowEmptySelection={false}
              selectionMode="none"
              onAction={(key: Key) => handleAddFilter(key as string)}>
              {remainingFilters.map((filter) => (
                <Dropdown.Item
                  id={filter.key}
                  key={filter.key}
                  label={filter.label}
                />
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </Typography>
    );
  }, [remainingFilters, handleAddFilter, t]);

  const { quickFilters: filterSection } = useQuickFiltersWithComponent({
    defaultFilters: visibleFilters,
    aggregations,
    parsedFilters,
    searchIndex: COLUMN_SEARCH_INDEXES,
    assetType: AssetsOfEntity.COLUMN,
    onFilterChange,
    additionalActions: addFilterButton,
  });

  return {
    filterSection,
    defaultFilters: visibleFilters,
  };
};
