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
  Dropdown,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown, FilterLines, Settings01 } from '@untitledui/icons';
import { useMemo, useState } from 'react';
import type { Key, Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { normalizeGraphLevel } from '../../utils/KnowledgeGraph.utils';
import ExportGraphPanel from '../OntologyExplorer/ExportGraphPanel';
import { ExportFormat } from '../OntologyExplorer/ExportGraphPanel.interface';
import { KnowledgeGraphToolbarProps } from './KnowledgeGraph.interface';

const KnowledgeGraphToolbar = ({
  selectedLevel,
  layout,
  labelMode,
  nodes,
  filters,
  filterOptions,
  onFindNode,
  onLevelChange,
  onLayoutChange,
  onLabelModeChange,
  onFiltersChange,
  onExportJsonLd,
  onExportPng,
  onExportTurtle,
}: KnowledgeGraphToolbarProps) => {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [entitySearch, setEntitySearch] = useState('');
  const [relationshipSearch, setRelationshipSearch] = useState('');
  const filterCount =
    filters.entityTypes.length + filters.relationshipTypes.length;
  const levels = [
    { id: '1', label: t('label.kg-selected-entity') },
    { id: '2', label: t('label.kg-direct-connections') },
    { id: '3', label: t('label.kg-extended-connections') },
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
          supportingText: node.type,
        })),
    [nodes, findText]
  );
  const changeView = (key: Key) => {
    switch (key) {
      case 'radial':
      case 'dagre':
        onLayoutChange(key);

        break;
      case 'auto':
      case 'all':
      case 'none':
        onLabelModeChange(key);

        break;
    }
  };
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
    <Box
      className="tw:w-full tw:min-w-0"
      data-testid="knowledge-graph-controls"
      direction="col"
      gap={3}>
      <Box align="center" gap={3} wrap="wrap">
        <Box align="center" gap={2}>
          <Typography weight="medium">{t('label.kg-levels')}</Typography>
          <Select
            aria-label={t('label.kg-levels')}
            className="tw:w-64 tw:max-w-full"
            data-testid="level-chooser"
            items={levels.map((level) => ({
              ...level,
              label: level.id + ' — ' + level.label,
            }))}
            selectedKey={String(selectedLevel)}
            size="sm"
            onSelectionChange={(key) => {
              if (key) {
                onLevelChange(normalizeGraphLevel(Number(key)));
              }
            }}>
            {(item) => (
              <Select.Item {...item} data-testid={'graph-level-' + item.id} />
            )}
          </Select>
        </Box>
        <Select.ComboBox
          aria-label={t('label.kg-find-in-graph')}
          className="tw:min-w-48 tw:max-w-sm tw:flex-1"
          emptyState={t('label.kg-no-results')}
          inputValue={findText}
          items={choices}
          placeholder={t('label.kg-find-in-graph')}
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
        <Box align="center" className="tw:ml-auto" gap={2} wrap="wrap">
          <Dropdown.Root>
            <Button
              color="secondary"
              data-testid="graph-view-menu"
              iconLeading={Settings01}
              size="sm">
              {t('label.view')}
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label={t('label.view')}
                selectedKeys={new Set([layout, labelMode])}
                selectionMode="multiple"
                onAction={changeView}>
                <Dropdown.Section>
                  <Dropdown.SectionHeader>
                    {t('label.layout')}
                  </Dropdown.SectionHeader>
                  <Dropdown.Item
                    showCheckbox
                    id="radial"
                    label={t('label.kg-concentric')}
                  />
                  <Dropdown.Item
                    showCheckbox
                    id="dagre"
                    label={t('label.hierarchical')}
                  />
                </Dropdown.Section>
                <Dropdown.Section>
                  <Dropdown.SectionHeader>
                    {t('label.kg-relationship-labels')}
                  </Dropdown.SectionHeader>
                  <Dropdown.Item
                    showCheckbox
                    id="auto"
                    label={t('label.kg-auto-labels')}
                  />
                  <Dropdown.Item
                    showCheckbox
                    id="all"
                    label={t('label.kg-all-labels')}
                  />
                  <Dropdown.Item
                    showCheckbox
                    id="none"
                    label={t('label.kg-no-labels')}
                  />
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
          <ExportGraphPanel
            data-testid="knowledge-graph-export"
            supportedExports={[
              ExportFormat.PNG,
              ExportFormat.JSONLD,
              ExportFormat.TURTLE,
            ]}
            onExportJsonLd={onExportJsonLd}
            onExportPng={onExportPng}
            onExportTurtle={onExportTurtle}
          />
        </Box>
      </Box>
      {(filtersOpen || filterCount > 0) && (
        <Box align="center" gap={3} wrap="wrap">
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
          {filterCount > 0 && (
            <Button
              color="link-gray"
              size="sm"
              onPress={() =>
                onFiltersChange({ entityTypes: [], relationshipTypes: [] })
              }>
              {t('label.clear-filter-plural')}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default KnowledgeGraphToolbar;
