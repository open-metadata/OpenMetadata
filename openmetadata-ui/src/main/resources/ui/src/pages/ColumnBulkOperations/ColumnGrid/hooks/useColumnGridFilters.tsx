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

import { AddOutlined } from '@mui/icons-material';
import { Button, Menu, MenuItem, useTheme } from '@mui/material';
import { defaultColors } from '@openmetadata/ui-core-components';
import {
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  const theme = useTheme();

  const [addedFilterKeys, setAddedFilterKeys] = useState<Set<string>>(
    new Set()
  );
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  // Auto-include additional filters that have active values from URL
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

  // Persist URL-active filters so they remain visible even after clearing values
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

  // Default filters first, then added filters in the order they were added
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

  const handleMenuOpen = useCallback((event: MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  const handleAddFilter = useCallback(
    (filterKey: string) => {
      setAddedFilterKeys((prev) => new Set([...prev, filterKey]));
      handleMenuClose();
    },
    [handleMenuClose]
  );

  const addFilterButton = useMemo(() => {
    if (remainingFilters.length === 0) {
      return null;
    }

    return (
      <>
        <Button
          startIcon={<AddOutlined />}
          sx={{
            color: defaultColors.blue[600],
            fontSize: theme.typography.body2.fontSize,
            fontWeight: theme.typography.subtitle2.fontWeight,
            padding: 0,
            minWidth: 'auto',
            whiteSpace: 'nowrap',
            marginLeft: theme.spacing(4 / 3),
            '& .MuiButton-startIcon > *': {
              width: '16px !important',
              height: '16px !important',
            },
            '&:hover, &:active, &:focus': {
              color: defaultColors.blue[600],
              background: defaultColors.white,
            },
          }}
          variant="text"
          onClick={handleMenuOpen}>
          {t('label.add-entity', { entity: t('label.filter') })}
        </Button>
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          slotProps={{
            paper: {
              sx: { width: 'auto' },
            },
          }}
          onClose={handleMenuClose}>
          {remainingFilters.map((filter) => (
            <MenuItem
              key={filter.key}
              sx={{
                color: defaultColors.gray[700],
                fontSize: theme.typography.body2.fontSize,
                fontWeight: theme.typography.subtitle2.fontWeight,
                padding: theme.spacing(1),
              }}
              onClick={() => handleAddFilter(filter.key)}>
              {filter.label}
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }, [
    remainingFilters,
    menuAnchorEl,
    handleMenuOpen,
    handleMenuClose,
    handleAddFilter,
    t,
    theme,
  ]);

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
