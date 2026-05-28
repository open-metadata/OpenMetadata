/*
 *  Copyright 2024 Collate.
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
  Button,
  Select,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SearchDropdown from '../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import {
  FilterToolbarProps,
  GraphViewMode,
} from './OntologyExplorer.interface';

const VIEW_MODES: { label: string; value: GraphViewMode }[] = [
  { label: 'label.overview', value: 'overview' },
  { label: 'label.hierarchy', value: 'hierarchy' },
  { label: 'label.cross-glossary', value: 'crossGlossary' },
];

const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters,
  glossaries,
  relationTypes,
  onFiltersChange,
  onViewModeChange,
  onClearAll,
  onLoadMore,
  viewModeDisabled = false,
  isLoading = false,
  isLoadingMore = false,
  hasMoreTerms = false,
  loadedTermCount,
  totalTermCount,
}) => {
  const { t } = useTranslation();

  const [glossaryOptions, setGlossaryOptions] = useState<
    SearchDropdownOption[]
  >([]);
  const [relationTypeOptions, setRelationTypeOptions] = useState<
    SearchDropdownOption[]
  >([]);

  const allGlossaryOptions = useMemo<SearchDropdownOption[]>(
    () =>
      glossaries.map((g) => ({
        key: g.id ?? '',
        label: g.displayName || g.name,
      })),
    [glossaries]
  );

  const allRelationTypeOptions = useMemo<SearchDropdownOption[]>(
    () =>
      relationTypes.map((rt) => ({
        key: rt.name,
        label: rt.displayName || rt.name,
      })),
    [relationTypes]
  );

  const selectedGlossaryKeys = useMemo<SearchDropdownOption[]>(
    () => allGlossaryOptions.filter((o) => filters.glossaryIds.includes(o.key)),
    [allGlossaryOptions, filters.glossaryIds]
  );

  const selectedRelationTypeKeys = useMemo<SearchDropdownOption[]>(
    () =>
      allRelationTypeOptions.filter((o) =>
        filters.relationTypes.includes(o.key)
      ),
    [allRelationTypeOptions, filters.relationTypes]
  );

  const handleGlossarySearch = useCallback(
    (value: string) => {
      const filtered = value
        ? allGlossaryOptions.filter((o) =>
            o.label.toLowerCase().includes(value.toLowerCase())
          )
        : allGlossaryOptions;
      setGlossaryOptions(filtered);
    },
    [allGlossaryOptions]
  );

  const handleRelationTypeSearch = useCallback(
    (value: string) => {
      const filtered = value
        ? allRelationTypeOptions.filter((o) =>
            o.label.toLowerCase().includes(value.toLowerCase())
          )
        : allRelationTypeOptions;
      setRelationTypeOptions(filtered);
    },
    [allRelationTypeOptions]
  );

  const handleGlossaryInitialOptions = useCallback(() => {
    setGlossaryOptions(allGlossaryOptions);
  }, [allGlossaryOptions]);

  const handleRelationTypeInitialOptions = useCallback(() => {
    setRelationTypeOptions(allRelationTypeOptions);
  }, [allRelationTypeOptions]);

  const handleGlossaryChange = useCallback(
    (values: SearchDropdownOption[]) => {
      onFiltersChange({
        ...filters,
        glossaryIds: values.map((v) => v.key),
      });
    },
    [filters, onFiltersChange]
  );

  const handleRelationTypeChange = useCallback(
    (values: SearchDropdownOption[]) => {
      onFiltersChange({
        ...filters,
        relationTypes: values.map((v) => v.key),
      });
    },
    [filters, onFiltersChange]
  );

  const hasActiveFilters =
    filters.glossaryIds.length > 0 || filters.relationTypes.length > 0;

  const viewModeItems = useMemo(
    () =>
      VIEW_MODES.map(({ label, value }) => ({
        id: value,
        label: t(label),
      })),
    [t]
  );

  return (
    <div className="tw:flex tw:w-full tw:items-center tw:gap-5 tw:pl-2">
      {/* View Mode dropdown — disabled in data mode or while loading */}
      <div
        className={
          'tw:flex tw:shrink-0 tw:items-center tw:gap-2' +
          (viewModeDisabled || isLoading
            ? ' tw:pointer-events-none tw:opacity-50'
            : '')
        }>
        <Typography
          as="span"
          className="tw:whitespace-nowrap tw:text-gray-600"
          size="text-sm"
          weight="medium">
          {t('label.view-mode')}:
        </Typography>
        <Select
          className="tw:w-36"
          data-testid="view-mode-select"
          fontSize="sm"
          isDisabled={viewModeDisabled || isLoading}
          items={viewModeItems}
          size="sm"
          value={filters.viewMode}
          onChange={(key) => {
            const viewMode = VIEW_MODES.find(
              (m) => m.value === String(key)
            )?.value;
            if (viewMode) {
              onViewModeChange?.(viewMode);
            }
          }}>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select>
      </div>

      {/* Glossary filter */}
      <div
        className={
          'tw:flex tw:shrink-0 tw:items-center' +
          (isLoading ? ' tw:pointer-events-none tw:opacity-50' : '')
        }
        data-testid="glossary-filter-section">
        <SearchDropdown
          hideCounts
          label={t('label.glossary')}
          options={glossaryOptions}
          searchKey="glossaryIds"
          selectedKeys={selectedGlossaryKeys}
          triggerButtonSize="middle"
          onChange={handleGlossaryChange}
          onGetInitialOptions={handleGlossaryInitialOptions}
          onSearch={handleGlossarySearch}
        />
      </div>

      <div
        className={
          'tw:flex tw:shrink-0 tw:items-center' +
          (isLoading ? ' tw:pointer-events-none tw:opacity-50' : '')
        }
        data-testid="relation-type-filter-section">
        <SearchDropdown
          hideCounts
          label={t('label.relationship-type')}
          options={relationTypeOptions}
          searchKey="relationTypes"
          selectedKeys={selectedRelationTypeKeys}
          triggerButtonSize="middle"
          onChange={handleRelationTypeChange}
          onGetInitialOptions={handleRelationTypeInitialOptions}
          onSearch={handleRelationTypeSearch}
        />
      </div>

      {/* Isolated toggle — disabled while loading or when Cross Glossary view removes all non-connected nodes */}
      <Toggle
        data-testid="ontology-isolated-toggle"
        isDisabled={isLoading || filters.showCrossGlossaryOnly}
        isSelected={filters.showIsolatedNodes}
        label={t('label.isolated')}
        size="sm"
        onChange={(checked) =>
          onFiltersChange({ ...filters, showIsolatedNodes: checked })
        }
      />

      <div className="tw:ml-auto tw:flex tw:items-center">
        {onLoadMore !== undefined &&
          loadedTermCount !== undefined &&
          totalTermCount !== undefined && (
            <Typography
              as="span"
              className="tw:whitespace-nowrap tw:pr-1 tw:text-(--color-text-tertiary)"
              size="text-sm">
              {t('label.loaded-x-of-y-entity', {
                loaded: loadedTermCount,
                total: totalTermCount,
                entity: t('label.term-plural'),
              })}
            </Typography>
          )}
        {onLoadMore !== undefined && (
          <Button
            className="tw:text-brand-600"
            color="tertiary"
            data-testid="ontology-load-more-btn"
            isDisabled={!hasMoreTerms || isLoading || isLoadingMore}
            size="sm"
            onClick={onLoadMore}>
            {t('label.load-more')}
          </Button>
        )}
        {onClearAll && hasActiveFilters && (
          <Button
            color="tertiary"
            data-testid="ontology-clear-all-btn"
            isDisabled={isLoading}
            size="sm"
            onClick={onClearAll}>
            {t('label.clear-entity', { entity: t('label.all-lowercase') })}
          </Button>
        )}
      </div>
    </div>
  );
};

export default FilterToolbar;
