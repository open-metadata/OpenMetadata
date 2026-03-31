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
  Autocomplete,
  Button,
  Divider,
  Select,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useCallback, useMemo } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ONTOLOGY_AUTOCOMPLETE_ALL_ID } from './OntologyExplorer.constants';
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
  viewModeDisabled = false,
}) => {
  const { t } = useTranslation();

  const handleGlossaryInserted = useCallback(
    (key: Key) => {
      const id = String(key);
      if (filters.glossaryIds.includes(id)) {
        return;
      }
      if (id === ONTOLOGY_AUTOCOMPLETE_ALL_ID) {
        onFiltersChange({
          ...filters,
          glossaryIds: [ONTOLOGY_AUTOCOMPLETE_ALL_ID],
        });

        return;
      }
      onFiltersChange({
        ...filters,
        glossaryIds: [
          ...filters.glossaryIds.filter(
            (g) => g !== ONTOLOGY_AUTOCOMPLETE_ALL_ID
          ),
          id,
        ],
      });
    },
    [filters, onFiltersChange]
  );

  const handleGlossaryCleared = useCallback(
    (key: Key) => {
      const id = String(key);
      onFiltersChange({
        ...filters,
        glossaryIds: filters.glossaryIds.filter((g) => g !== id),
      });
    },
    [filters, onFiltersChange]
  );

  const handleRelationTypeInserted = useCallback(
    (key: Key) => {
      const id = String(key);
      if (filters.relationTypes.includes(id)) {
        return;
      }
      if (id === ONTOLOGY_AUTOCOMPLETE_ALL_ID) {
        onFiltersChange({
          ...filters,
          relationTypes: [ONTOLOGY_AUTOCOMPLETE_ALL_ID],
        });

        return;
      }
      onFiltersChange({
        ...filters,
        relationTypes: [
          ...filters.relationTypes.filter(
            (rt) => rt !== ONTOLOGY_AUTOCOMPLETE_ALL_ID
          ),
          id,
        ],
      });
    },
    [filters, onFiltersChange]
  );

  const handleRelationTypeCleared = useCallback(
    (key: Key) => {
      const id = String(key);
      onFiltersChange({
        ...filters,
        relationTypes: filters.relationTypes.filter((rt) => rt !== id),
      });
    },
    [filters, onFiltersChange]
  );

  const hasActiveFilters =
    filters.glossaryIds.length > 0 || filters.relationTypes.length > 0;

  const glossaryAllOnlySelected = filters.glossaryIds.includes(
    ONTOLOGY_AUTOCOMPLETE_ALL_ID
  );

  const glossaryItems = useMemo(
    () => [
      {
        id: ONTOLOGY_AUTOCOMPLETE_ALL_ID,
        label: t('label.all'),
      },
      ...glossaries.map((g) => ({
        id: g.id ?? '',
        label: g.displayName || g.name,
        isDisabled: glossaryAllOnlySelected,
      })),
    ],
    [glossaries, t, glossaryAllOnlySelected]
  );

  const selectedGlossaryItems = useMemo(
    () => glossaryItems.filter((g) => filters.glossaryIds.includes(g.id)),
    [glossaryItems, filters.glossaryIds]
  );

  const relationTypeAllOnlySelected = filters.relationTypes.includes(
    ONTOLOGY_AUTOCOMPLETE_ALL_ID
  );

  const relationTypeItems = useMemo(
    () => [
      {
        id: ONTOLOGY_AUTOCOMPLETE_ALL_ID,
        label: t('label.all'),
      },
      ...relationTypes.map((rt) => ({
        id: rt.name,
        label: rt.displayName || rt.name,
        isDisabled: relationTypeAllOnlySelected,
      })),
    ],
    [relationTypes, t, relationTypeAllOnlySelected]
  );

  const selectedRelationTypeItems = useMemo(
    () =>
      relationTypeItems.filter((rt) => filters.relationTypes.includes(rt.id)),
    [relationTypeItems, filters.relationTypes]
  );

  const viewModeItems = useMemo(
    () =>
      VIEW_MODES.map(({ label, value }) => ({
        id: value,
        label: t(label),
      })),
    [t]
  );

  return (
    <div className="tw:flex tw:w-full tw:items-center tw:gap-3">
      {/* View Mode dropdown — disabled in data mode */}
      <div
        className={
          'tw:flex tw:shrink-0 tw:items-center tw:gap-2' +
          (viewModeDisabled ? ' tw:pointer-events-none tw:opacity-50' : '')
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
      {glossaryItems.length > 0 && (
        <>
          <Divider orientation="vertical" />
          <div
            className="tw:flex tw:shrink-0 tw:items-center tw:gap-2"
            data-testid="glossary-filter-section">
            <Typography as="span" size="text-sm" weight="medium">
              {t('label.glossary')}:
            </Typography>
            <div className="tw:w-56">
              <Autocomplete
                items={glossaryItems}
                maxVisibleItems={1}
                placeholder={t('label.all')}
                selectedItems={selectedGlossaryItems}
                onItemCleared={handleGlossaryCleared}
                onItemInserted={handleGlossaryInserted}>
                {(item) => (
                  <Autocomplete.Item
                    id={item.id}
                    isDisabled={item.isDisabled}
                    label={item.label ?? ''}
                  />
                )}
              </Autocomplete>
            </div>
          </div>
        </>
      )}

      {/* Relation type filter */}
      {relationTypeItems.length > 0 && (
        <>
          <Divider orientation="vertical" />
          <div
            className="tw:flex tw:shrink-0 tw:items-center tw:gap-2"
            data-testid="relation-type-filter-section">
            <Typography as="span" size="text-sm" weight="medium">
              {t('label.relationship-type')}:
            </Typography>
            <div className="tw:w-56">
              <Autocomplete
                items={relationTypeItems}
                maxVisibleItems={1}
                placeholder={t('label.all')}
                selectedItems={selectedRelationTypeItems}
                onItemCleared={handleRelationTypeCleared}
                onItemInserted={handleRelationTypeInserted}>
                {(item) => (
                  <Autocomplete.Item
                    id={item.id}
                    isDisabled={item.isDisabled}
                    label={item.label ?? ''}
                  />
                )}
              </Autocomplete>
            </div>
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

      {onClearAll && hasActiveFilters && (
        <>
          <div className="tw:ml-auto" />
          <Button
            color="tertiary"
            data-testid="ontology-clear-all-btn"
            size="sm"
            onClick={onClearAll}>
            {t('clear-entity', {
              entity: t('label.all'),
            })}
          </Button>
        </>
      )}
    </div>
  );
};

export default FilterToolbar;
