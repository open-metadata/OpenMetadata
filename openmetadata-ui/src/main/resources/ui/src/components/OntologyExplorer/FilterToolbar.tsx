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
  ButtonUtility,
  Dropdown,
  Tabs,
  Toggle,
} from '@openmetadata/ui-core-components';
import { ChevronDown, X } from '@untitledui/icons';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';
import { GraphFilters, GraphViewMode } from './OntologyExplorer.interface';

interface FilterToolbarProps {
  filters: GraphFilters;
  glossaries: Glossary[];
  relationTypes: GlossaryTermRelationType[];
  onFiltersChange: (filters: GraphFilters) => void;
  onViewModeChange?: (viewMode: GraphViewMode) => void;
}

const VIEW_MODES: { label: string; value: GraphViewMode }[] = [
  { label: 'label.overview', value: 'overview' },
  { label: 'label.hierarchy', value: 'hierarchy' },
  { label: 'label.related', value: 'neighborhood' },
  { label: 'label.cross-glossary', value: 'crossGlossary' },
];

const DEPTH_OPTION_IDS = ['0', '1', '2', '3'] as const;

const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters,
  glossaries,
  relationTypes,
  onFiltersChange,
  onViewModeChange,
}) => {
  const { t } = useTranslation();

  const handleDepthChange = useCallback(
    (key: React.Key | null) => {
      if (key != null) {
        onFiltersChange({ ...filters, depth: Number(key) });
      }
    },
    [filters, onFiltersChange]
  );

  const handleGlossaryChange = useCallback(
    (key: React.Key | null) => {
      onFiltersChange({
        ...filters,
        glossaryIds: key ? [String(key)] : [],
      });
    },
    [filters, onFiltersChange]
  );

  const handleRelationTypeChange = useCallback(
    (key: React.Key | null) => {
      onFiltersChange({
        ...filters,
        relationTypes: key ? [String(key)] : [],
      });
    },
    [filters, onFiltersChange]
  );

  const handleViewModeChange = useCallback(
    (value: string | number) => {
      onViewModeChange?.(value as GraphViewMode);
    },
    [onViewModeChange]
  );

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      viewMode: 'overview',
      glossaryIds: [],
      relationTypes: [],
      hierarchyLevels: [],
      showIsolatedNodes: true,
      showCrossGlossaryOnly: false,
      searchQuery: '',
      depth: 0,
    });
  }, [onFiltersChange]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.viewMode !== 'overview' ||
      filters.glossaryIds.length > 0 ||
      filters.relationTypes.length > 0 ||
      filters.searchQuery.length > 0 ||
      !filters.showIsolatedNodes ||
      filters.showCrossGlossaryOnly ||
      filters.depth > 0
    );
  }, [filters]);

  const depthItems = useMemo(
    () => [
      { id: '0', label: t('label.all') },
      ...DEPTH_OPTION_IDS.slice(1).map((id) => ({ id, label: id })),
    ],
    [t]
  );

  const glossaryItems = useMemo(
    () =>
      glossaries.map((g) => ({
        id: g.id ?? '',
        label: g.displayName || g.name,
      })),
    [glossaries]
  );

  const relationTypeItems = useMemo(
    () =>
      relationTypes.map((rt) => ({
        id: rt.name,
        label: rt.displayName || rt.name,
      })),
    [relationTypes]
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
    <div className="tw:flex tw:items-center tw:gap-2">
      {/* Glossary filter */}
      {glossaryItems.length > 0 && (
        <Dropdown.Root>
          <Button color="secondary" iconTrailing={ChevronDown} size="sm">
            {glossaryItems.find((g) => g.id === filters.glossaryIds[0])
              ?.label ?? t('label.glossary')}
          </Button>
          <Dropdown.Popover className="tw:min-w-45">
            <Dropdown.Menu
              items={glossaryItems}
              onAction={(key) => handleGlossaryChange(key as string)}>
              {(item) => (
                <Dropdown.Item id={item.id} label={item.label ?? ''} />
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      )}

      {/* Relation type filter */}
      {relationTypeItems.length > 0 && (
        <Dropdown.Root>
          <Button color="secondary" iconTrailing={ChevronDown} size="sm">
            {relationTypeItems.find((r) => r.id === filters.relationTypes[0])
              ?.label ?? t('label.relation-type')}
          </Button>
          <Dropdown.Popover className="tw:min-w-45">
            <Dropdown.Menu
              items={relationTypeItems}
              onAction={(key) => handleRelationTypeChange(key as string)}>
              {(item) => (
                <Dropdown.Item id={item.id} label={item.label ?? ''} />
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      )}

      {/* Depth */}
      <Dropdown.Root>
        <Button color="secondary" iconTrailing={ChevronDown} size="sm">
          {depthItems.find((d) => d.id === String(filters.depth))?.label ??
            t('label.depth')}
        </Button>
        <Dropdown.Popover className="tw:min-w-45">
          <Dropdown.Menu
            items={depthItems}
            onAction={(key) => handleDepthChange(key as string)}>
            {(item) => <Dropdown.Item id={item.id} label={item.label ?? ''} />}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>

      <div className="tw:w-fit tw:grow-0 tw:shrink-0">
        <Tabs
          className="tw:w-fit!"
          selectedKey={filters.viewMode}
          onSelectionChange={(key) =>
            key != null && handleViewModeChange(key as GraphViewMode)
          }>
          <Tabs.List items={viewModeTabItems} size="sm" type="button-border" />
          {viewModeTabItems.map((item) => (
            <Tabs.Panel className="tw:hidden" id={item.id} key={item.id} />
          ))}
        </Tabs>
      </div>

      <Toggle
        data-testid="ontology-isolated-toggle"
        isSelected={filters.showIsolatedNodes}
        label={t('label.isolated')}
        size="sm"
        onChange={(checked) =>
          onFiltersChange({ ...filters, showIsolatedNodes: checked })
        }
      />

      {/* Cross-glossary toggle */}
      <Toggle
        data-testid="ontology-cross-glossary-toggle"
        isSelected={filters.showCrossGlossaryOnly}
        label={t('label.cross-glossary')}
        size="sm"
        onChange={(checked) =>
          onFiltersChange({ ...filters, showCrossGlossaryOnly: checked })
        }
      />

      {/* Clear filters */}
      {hasActiveFilters && (
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-clear-filters"
          icon={X}
          size="sm"
          tooltip={t('label.clear-filter-plural')}
          onClick={handleClearFilters}
        />
      )}
    </div>
  );
};

export default FilterToolbar;
