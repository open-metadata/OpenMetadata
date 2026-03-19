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
  Dropdown,
  Tabs,
  Toggle,
} from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  viewModeDisabled = false,
}) => {
  const { t } = useTranslation();

  const handleGlossaryChange = useCallback(
    (key: React.Key | null) => {
      const isAll = key === null || String(key) === '__all__';
      onFiltersChange({
        ...filters,
        glossaryIds: isAll ? [] : [String(key)],
      });
    },
    [filters, onFiltersChange]
  );

  const handleRelationTypeChange = useCallback(
    (key: React.Key | null) => {
      const isAll = key === null || String(key) === '__all__';
      onFiltersChange({
        ...filters,
        relationTypes: isAll ? [] : [String(key)],
      });
    },
    [filters, onFiltersChange]
  );

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      viewMode: 'overview',
      glossaryIds: [],
      relationTypes: [],
      showIsolatedNodes: true,
      showCrossGlossaryOnly: false,
      searchQuery: '',
    });
  }, [onFiltersChange]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.viewMode !== 'overview' ||
      filters.glossaryIds.length > 0 ||
      filters.relationTypes.length > 0 ||
      filters.searchQuery.length > 0 ||
      !filters.showIsolatedNodes ||
      filters.showCrossGlossaryOnly
    );
  }, [filters]);

  const glossaryItems = useMemo(
    () => [
      {
        id: '__all__',
        label: t('label.all'),
      },
      ...glossaries.map((g) => ({
        id: g.id ?? '',
        label: g.displayName || g.name,
      })),
    ],
    [glossaries, t]
  );

  const relationTypeItems = useMemo(
    () => [
      {
        id: '__all__',
        label: t('label.all'),
      },
      ...relationTypes.map((rt) => ({
        id: rt.name,
        label: rt.displayName || rt.name,
      })),
    ],
    [relationTypes, t]
  );

  const viewModeTabItems = useMemo(
    () =>
      VIEW_MODES.map(({ label, value }) => ({
        id: value,
        label: t(label),
      })),
    [t]
  );

  return (
    <div className="tw:flex tw:w-full tw:items-center tw:gap-3">
      {/* View Mode tabs — disabled in data mode */}
      <div
        className={
          'tw:flex tw:shrink-0 tw:items-center tw:gap-2' +
          (viewModeDisabled ? ' tw:pointer-events-none tw:opacity-50' : '')
        }>
        <span className="tw:whitespace-nowrap tw:text-sm tw:font-medium tw:text-gray-600">
          {t('label.view-mode')}:
        </span>
        <Tabs
          className="tw:w-fit!"
          selectedKey={filters.viewMode}
          onSelectionChange={(key) => {
            if (viewModeDisabled) {
              return;
            }
            const viewMode = VIEW_MODES.find(
              (m) => m.value === String(key)
            )?.value;
            if (viewMode) {
              onViewModeChange?.(viewMode);
            }
          }}>
          <Tabs.List items={viewModeTabItems} size="sm" type="button-border" />
          {viewModeTabItems.map((item) => (
            <Tabs.Panel className="tw:hidden" id={item.id} key={item.id} />
          ))}
        </Tabs>
      </div>

      {/* Glossary filter */}
      {glossaryItems.length > 0 && (
        <>
          <div className="tw:h-5 tw:w-px tw:shrink-0 tw:bg-gray-200" />
          <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
            <span className="tw:whitespace-nowrap tw:text-sm tw:font-medium tw:text-gray-600">
              {t('label.glossary')}:
            </span>
            <Dropdown.Root>
              <Button color="secondary" iconTrailing={ChevronDown} size="sm">
                {glossaryItems.find((g) => g.id === filters.glossaryIds[0])
                  ?.label ?? t('label.all')}
              </Button>
              <Dropdown.Popover className="tw:min-w-45">
                <Dropdown.Menu
                  items={glossaryItems}
                  onAction={(key) => handleGlossaryChange(key)}>
                  {(item) => (
                    <Dropdown.Item id={item.id} label={item.label ?? ''} />
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </div>
        </>
      )}

      {/* Relation type filter */}
      {relationTypeItems.length > 0 && (
        <>
          <div className="tw:h-5 tw:w-px tw:shrink-0 tw:bg-gray-200" />
          <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
            <span className="tw:whitespace-nowrap tw:text-sm tw:font-medium tw:text-gray-600">
              {t('label.relationship-type')}:
            </span>
            <Dropdown.Root>
              <Button color="secondary" iconTrailing={ChevronDown} size="sm">
                {relationTypeItems.find(
                  (r) => r.id === filters.relationTypes[0]
                )?.label ?? t('label.all')}
              </Button>
              <Dropdown.Popover className="tw:min-w-45">
                <Dropdown.Menu
                  items={relationTypeItems}
                  onAction={(key) => handleRelationTypeChange(key)}>
                  {(item) => (
                    <Dropdown.Item id={item.id} label={item.label ?? ''} />
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </div>
        </>
      )}

      <div className="tw:h-5 tw:w-px tw:shrink-0 tw:bg-gray-200" />

      {/* Isolated toggle */}
      <Toggle
        data-testid="ontology-isolated-toggle"
        isSelected={filters.showIsolatedNodes}
        label={t('label.isolated')}
        size="sm"
        onChange={(checked) =>
          onFiltersChange({ ...filters, showIsolatedNodes: checked })
        }
      />

      {/* Clear filters — pushed to far right */}
      {hasActiveFilters && (
        <div className="tw:ml-auto tw:shrink-0">
          <Button
            className="tw:!border-none tw:!bg-transparent tw:!px-0 tw:text-[14px] tw:font-medium tw:text-[#535862]"
            color="tertiary"
            data-testid="ontology-clear-filters"
            size="sm"
            onClick={handleClearFilters}>
            {`${t('label.clear')} ${t('label.all')}`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default FilterToolbar;
