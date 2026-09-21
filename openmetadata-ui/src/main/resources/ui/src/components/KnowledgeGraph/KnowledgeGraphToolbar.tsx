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

import {
  Box,
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Checkbox,
  Dropdown,
  Input,
  Popover,
  PopoverTrigger,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  BookClosed,
  ChevronDown,
  Dataflow02,
  Expand01,
  FilterLines,
  Minimize01,
  Settings01,
} from '@untitledui/icons';
import { useMemo, useState } from 'react';
import type { Selection } from 'react-aria-components';
import { Heading } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { getEntityNameLabel } from '../../utils/EntityNameUtils';
import { normalizeGraphLevel } from '../../utils/KnowledgeGraph.utils';
import ExportGraphPanel from '../OntologyExplorer/ExportGraphPanel';
import { ExportFormat } from '../OntologyExplorer/ExportGraphPanel.interface';
import { KnowledgeGraphToolbarProps } from './KnowledgeGraph.interface';
import {
  getRelationStyle,
  RELATION_CATEGORIES,
} from './KnowledgeGraph.relations';

type GraphControl = 'level' | 'find' | 'view';

const GraphFilterControls = ({
  filters,
  filterOptions,
  excludedFamilies,
  familyCounts,
  onToggleFamily,
  onClearFilters,
  onFiltersChange,
}: Pick<
  KnowledgeGraphToolbarProps,
  | 'filters'
  | 'filterOptions'
  | 'excludedFamilies'
  | 'familyCounts'
  | 'onToggleFamily'
  | 'onClearFilters'
  | 'onFiltersChange'
>) => {
  const { t } = useTranslation();
  const [entitySearch, setEntitySearch] = useState('');
  const [relationshipSearch, setRelationshipSearch] = useState('');
  const selectFilter = (
    field: 'entityTypes' | 'relationshipTypes',
    keys: Selection
  ) => {
    onFiltersChange({
      ...filters,
      [field]:
        keys === 'all'
          ? (filterOptions?.[field] ?? []).map((item) => item.id)
          : Array.from(keys, String),
    });
  };

  return (
    <Box align="center" gap={3} wrap="wrap">
      {RELATION_CATEGORIES.filter((family) => familyCounts[family] > 0).map(
        (family) => (
          <Button
            aria-pressed={!excludedFamilies.includes(family)}
            className="tw:rounded-full"
            color="secondary"
            data-testid={'graph-filter-family-' + family}
            key={family}
            size="xs"
            onPress={() => onToggleFamily(family)}>
            <Box align="center" gap={1}>
              <svg aria-hidden="true" height="10" width="10">
                <circle
                  cx="5"
                  cy="5"
                  fill={getRelationStyle(family).color}
                  r="4"
                />
              </svg>
              {t(getRelationStyle(family).labelKey)} {familyCounts[family]}
            </Box>
          </Button>
        )
      )}
      <Dropdown.Root onOpenChange={() => setEntitySearch('')}>
        <Button
          color="secondary"
          iconTrailing={ChevronDown}
          isDisabled={!filterOptions?.entityTypes.length}
          size="sm">
          {t('label.entity-type')}
          {filters.entityTypes.length > 0
            ? ' (' + filters.entityTypes.length + ')'
            : ''}
        </Button>
        <Dropdown.Popover>
          <Box className="tw:px-3 tw:py-2">
            <Input
              aria-label={t('label.entity-type')}
              placeholder={t('label.search')}
              size="sm"
              value={entitySearch}
              onChange={setEntitySearch}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </Box>
          <Dropdown.Menu
            disallowEmptySelection={false}
            items={(filterOptions?.entityTypes ?? []).filter((item) =>
              item.label.toLowerCase().includes(entitySearch.toLowerCase())
            )}
            selectedKeys={new Set(filters.entityTypes)}
            selectionMode="multiple"
            onSelectionChange={(keys) => selectFilter('entityTypes', keys)}>
            {(item) => (
              <Dropdown.Item
                showCheckbox
                id={item.id}
                label={item.label + ' (' + item.count + ')'}
              />
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      <Dropdown.Root onOpenChange={() => setRelationshipSearch('')}>
        <Button
          color="secondary"
          iconTrailing={ChevronDown}
          isDisabled={!filterOptions?.relationshipTypes.length}
          size="sm">
          {t('label.relationship-type')}
          {filters.relationshipTypes.length > 0
            ? ' (' + filters.relationshipTypes.length + ')'
            : ''}
        </Button>
        <Dropdown.Popover>
          <Box className="tw:px-3 tw:py-2">
            <Input
              aria-label={t('label.relationship-type')}
              placeholder={t('label.search')}
              size="sm"
              value={relationshipSearch}
              onChange={setRelationshipSearch}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </Box>
          <Dropdown.Menu
            disallowEmptySelection={false}
            items={(filterOptions?.relationshipTypes ?? []).filter((item) =>
              item.label
                .toLowerCase()
                .includes(relationshipSearch.toLowerCase())
            )}
            selectedKeys={new Set(filters.relationshipTypes)}
            selectionMode="multiple"
            onSelectionChange={(keys) =>
              selectFilter('relationshipTypes', keys)
            }>
            {(item) => (
              <Dropdown.Item
                showCheckbox
                id={item.id}
                label={item.label + ' (' + item.count + ')'}
              />
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      <Button color="link-gray" size="sm" onPress={onClearFilters}>
        {t('label.clear-filter-plural')}
      </Button>
    </Box>
  );
};

const KnowledgeGraphToolbar = ({
  selectedLevel,
  layout,
  labelMode,
  mode,
  nodes,
  filters,
  filterOptions,
  presentation,
  showBands,
  excludedFamilies,
  familyCounts,
  ontology,
  viewport,
  onPresentationChange,
  onToggleBands,
  onToggleFamily,
  onClearFilters,
  hasFilters = false,
  onFindNode,
  onLevelChange,
  onLayoutChange,
  onLabelModeChange,
  onFiltersChange,
  onModeChange,
  onExportJsonLd,
  onExportPng,
  onExportTurtle,
  onExportCsv,
}: KnowledgeGraphToolbarProps) => {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [openControl, setOpenControl] = useState<GraphControl | null>(null);
  const changeOpenControl = (control: GraphControl, open: boolean) => {
    setOpenControl((current) => {
      if (open) {
        return control;
      }

      return current === control ? null : current;
    });
  };
  const filterCount =
    filters.entityTypes.length +
    filters.relationshipTypes.length +
    excludedFamilies.length;
  const levels = [
    {
      id: '1',
      label: t('label.entity'),
      description: t('label.kg-selected-entity'),
    },
    {
      id: '2',
      label: t('label.direct'),
      description: t('label.kg-direct-connections'),
    },
    {
      id: '3',
      label: t('label.extended'),
      description: t('label.kg-extended-connections'),
    },
  ];
  const choices = useMemo(
    () =>
      nodes
        .filter((node) =>
          [node.label, node.fullyQualifiedName, node.type].some((value) =>
            value?.toLowerCase().includes(findText.toLowerCase())
          )
        )
        .map((node) => ({
          id: node.id,
          label: node.label,
          supportingText:
            node.fullyQualifiedName ?? getEntityNameLabel(node.type),
        })),
    [nodes, findText]
  );

  return (
    <Box
      className="tw:w-full tw:min-w-0"
      data-testid="knowledge-graph-controls"
      direction="col"
      gap={3}>
      <Box align="center" gap={3} wrap="wrap">
        <Box
          className="tw:max-w-full tw:min-w-0"
          data-testid="graph-mode-chooser">
          <ButtonGroup
            disallowEmptySelection
            aria-label={t('label.mode')}
            className="tw:max-w-full tw:flex-wrap"
            selectedKeys={new Set([mode])}
            size="sm"
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (next === 'ontology' || next === 'knowledge-graph') {
                onModeChange(next);
              }
            }}>
            <ButtonGroupItem iconLeading={Dataflow02} id="knowledge-graph">
              {t('label.knowledge-graph')}
            </ButtonGroupItem>
            <ButtonGroupItem iconLeading={BookClosed} id="ontology">
              {t('label.ontology')}
            </ButtonGroupItem>
          </ButtonGroup>
        </Box>
        <Box align="center" className="tw:min-w-0 tw:max-w-full" gap={2}>
          <Typography
            className="tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.kg-levels')}
          </Typography>
          <Select
            aria-label={t('label.kg-levels')}
            className="tw:w-36 tw:min-w-0 tw:max-w-full tw:flex-1"
            data-testid="level-chooser"
            isOpen={openControl === 'level'}
            items={levels.map((level) => ({
              ...level,
              label: level.id + ' · ' + level.label,
            }))}
            popoverClassName="tw:min-w-40 tw:max-w-full"
            selectedKey={String(selectedLevel)}
            size="sm"
            onOpenChange={(open) => changeOpenControl('level', open)}
            onSelectionChange={(key) => {
              if (key) {
                onLevelChange(normalizeGraphLevel(Number(key)));
              }
            }}>
            {(item) => (
              <Select.Item
                className="tw:[&_[slot=description]]:w-full tw:[&_[slot=description]]:text-xs tw:[&_[slot=description]]:whitespace-normal"
                data-testid={'graph-level-' + item.id}
                id={item.id}
                label={item.label}
                value={{ id: item.id, label: item.label }}
              />
            )}
          </Select>
        </Box>
        {mode === 'ontology' && ontology.concepts.length > 0 && (
          <Select
            aria-label={t('label.kg-concept')}
            className="tw:w-64 tw:max-w-full"
            items={ontology.concepts.map((concept) => ({
              id: concept.id,
              label: concept.label,
            }))}
            selectedKey={ontology.selectedId}
            size="sm"
            onSelectionChange={(key) => {
              if (key) {
                ontology.onChange(String(key));
              }
            }}>
            {(item) => <Select.Item {...item} />}
          </Select>
        )}
        <Select.ComboBox
          aria-label={t('label.kg-find-in-graph')}
          className="kg-find"
          emptyState={t('label.kg-no-results')}
          fontSize="sm"
          inputValue={findText}
          items={choices}
          placeholder={t('label.kg-find-placeholder')}
          shortcut={false}
          size="sm"
          onInputChange={setFindText}
          onSelectionChange={(key) => {
            if (key) {
              onFindNode(String(key));
            }
          }}>
          {(item) => <Select.Item {...item} />}
        </Select.ComboBox>
        <Button
          aria-expanded={filtersOpen}
          color="secondary"
          data-testid="graph-filters-toggle"
          iconLeading={FilterLines}
          size="sm"
          onPress={() => setFiltersOpen((open) => !open)}>
          {t('label.filter-plural')}
          {filterCount > 0 ? ' (' + filterCount + ')' : ''}
        </Button>
        <Box align="center" className="tw:ml-auto" gap={2}>
          <PopoverTrigger
            isOpen={openControl === 'view'}
            onOpenChange={(open) => changeOpenControl('view', open)}>
            <Button
              color="secondary"
              data-testid="graph-view-menu"
              iconLeading={Settings01}
              size="sm">
              {t('label.view')}
            </Button>
            <Popover
              aria-label={t('label.view')}
              className="tw:w-64 tw:max-w-full tw:motion-reduce:animate-none"
              data-testid="graph-view-settings"
              placement="bottom end">
              <Box className="tw:p-4" direction="col" gap={4}>
                <Typography
                  as={Heading}
                  className="tw:m-0! tw:text-sm! tw:leading-5!"
                  size="text-sm"
                  slot="title"
                  weight="semibold">
                  {t('label.view')}
                </Typography>
                <Select
                  aria-label={t('label.kg-presentation')}
                  data-testid="graph-presentation-chooser"
                  label={t('label.kg-presentation')}
                  selectedKey={presentation}
                  size="sm"
                  onSelectionChange={(key) => {
                    if (key === 'balanced' || key === 'all') {
                      onPresentationChange(key);
                    }
                  }}>
                  <Select.Item id="balanced" label={t('label.kg-balanced')} />
                  <Select.Item id="all" label={t('label.kg-every-entity')} />
                </Select>
                <Select
                  data-testid="graph-layout-chooser"
                  label={t('label.layout')}
                  selectedKey={layout}
                  size="sm"
                  onSelectionChange={(key) => {
                    if (
                      key === 'radial' ||
                      key === 'dagre' ||
                      key === 'lanes'
                    ) {
                      onLayoutChange(key);
                    }
                  }}>
                  <Select.Item id="lanes" label={t('label.kg-lanes')} />
                  <Select.Item id="radial" label={t('label.kg-concentric')} />
                  <Select.Item id="dagre" label={t('label.hierarchical')} />
                </Select>
                <Select
                  data-testid="graph-label-chooser"
                  label={t('label.kg-relationship-labels')}
                  selectedKey={labelMode}
                  size="sm"
                  onSelectionChange={(key) => {
                    if (key === 'auto' || key === 'all' || key === 'none') {
                      onLabelModeChange(key);
                    }
                  }}>
                  <Select.Item id="auto" label={t('label.kg-auto-labels')} />
                  <Select.Item id="all" label={t('label.kg-all-labels')} />
                  <Select.Item id="none" label={t('label.kg-no-labels')} />
                </Select>
                <Checkbox
                  isSelected={showBands}
                  label={t('label.kg-level-bands')}
                  onChange={onToggleBands}
                />
                <Box className="tw:border-t tw:border-secondary tw:pt-3">
                  <ExportGraphPanel
                    data-testid="knowledge-graph-export"
                    description={
                      mode === 'ontology'
                        ? t('message.kg-ontology-export')
                        : undefined
                    }
                    supportedExports={[
                      ExportFormat.PNG,
                      ExportFormat.JSONLD,
                      ExportFormat.TURTLE,
                      ExportFormat.CSV,
                    ]}
                    onExportCsv={onExportCsv}
                    onExportJsonLd={onExportJsonLd}
                    onExportPng={onExportPng}
                    onExportTurtle={onExportTurtle}
                  />
                </Box>
              </Box>
            </Popover>
          </PopoverTrigger>
          <Button
            aria-label={t(
              viewport.isFullscreen
                ? 'label.exit-full-screen'
                : 'label.full-screen-view'
            )}
            color="tertiary"
            data-testid={
              viewport.isFullscreen ? 'exit-full-screen' : 'full-screen'
            }
            iconLeading={viewport.isFullscreen ? Minimize01 : Expand01}
            size="sm"
            onPress={viewport.onFullscreen}
          />
        </Box>
      </Box>
      {(filtersOpen || hasFilters) && (
        <GraphFilterControls
          excludedFamilies={excludedFamilies}
          familyCounts={familyCounts}
          filterOptions={filterOptions}
          filters={filters}
          onClearFilters={onClearFilters}
          onFiltersChange={onFiltersChange}
          onToggleFamily={onToggleFamily}
        />
      )}
    </Box>
  );
};

export default KnowledgeGraphToolbar;
