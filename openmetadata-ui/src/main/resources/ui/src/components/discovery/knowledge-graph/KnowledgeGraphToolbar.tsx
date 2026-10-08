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
  Box,
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Checkbox,
  Popover,
  PopoverTrigger,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  BookClosed,
  Dataflow02,
  Expand01,
  Minimize01,
  Settings01,
} from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { Heading } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { SearchDropdownOption } from '../../../interface/quickFilter.interface';
import { GraphFilterOption } from '../../../types/knowledgeGraph.types';
import { normalizeGraphLevel } from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import {
  groupEntityTypeChoices,
  KnowledgeGraphEntityGroupSection,
} from '../../../utils/discovery/knowledge-graph/knowledgeGraphEntityGroups';
import {
  groupRelationshipTypeChoices,
  KnowledgeGraphRelationshipGroupSection,
} from '../../../utils/discovery/knowledge-graph/knowledgeGraphRelationshipGroups';
import { getEntityNameLabel } from '../../../utils/EntityNameUtils';
import FilterSelectDropdown from '../../common/FilterSelectDropdown/FilterSelectDropdown';
import ExportGraphPanel from '../../OntologyExplorer/ExportGraphPanel';
import { ExportFormat } from '../../OntologyExplorer/ExportGraphPanel.interface';
import { KnowledgeGraphToolbarProps } from './KnowledgeGraph.interface';

type GraphControl = 'level' | 'find' | 'view';

interface GroupedSection<T extends string> {
  key: T;
  labelKey: string;
  choices: GraphFilterOption[];
}

/**
 * Flatten sectioned choices into the flat `SearchDropdownOption[]` shape
 * FilterSelectDropdown consumes, prefixing each row's label with its group
 * so the tree-like structure (Databases → Table, Lineage → upstream, …) is
 * still readable in a single-column dropdown.
 */
const flattenSections = <T extends string>(
  sections: GroupedSection<T>[],
  t: (key: string) => string
): SearchDropdownOption[] =>
  sections.flatMap((section) =>
    section.choices.map((choice) => ({
      key: choice.id,
      label: t(section.labelKey) + ' · ' + choice.label,
      count: choice.count,
    }))
  );

interface PickerProps {
  filters: KnowledgeGraphToolbarProps['filters'];
  filterOptions: KnowledgeGraphToolbarProps['filterOptions'];
  onFiltersChange: KnowledgeGraphToolbarProps['onFiltersChange'];
}

const toSelectedOptions = (
  values: string[],
  options: SearchDropdownOption[]
): SearchDropdownOption[] => {
  const byKey = new Map(options.map((option) => [option.key, option]));

  return values.map(
    (value) => byKey.get(value) ?? { key: value, label: value }
  );
};

/**
 * Entity Type dropdown — rendered through the shared FilterSelectDropdown
 * shell, with each option labelled `<Group> · <Type>` so the Explore mental
 * model (Databases, Dashboards, …, Owners) reads inline in a flat list.
 */
const EntityTypePicker = ({
  filters,
  filterOptions,
  onFiltersChange,
}: PickerProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const options = useMemo<SearchDropdownOption[]>(() => {
    const filtered = (filterOptions?.entityTypes ?? []).filter((item) =>
      item.label.toLowerCase().includes(search.toLowerCase())
    );
    const sections: KnowledgeGraphEntityGroupSection[] =
      groupEntityTypeChoices(filtered);

    return flattenSections(sections, t);
  }, [filterOptions?.entityTypes, search, t]);
  const selectedKeys = useMemo(
    () => toSelectedOptions(filters.entityTypes, options),
    [filters.entityTypes, options]
  );

  return (
    <FilterSelectDropdown
      immediateApply
      showSelectAll
      label={t('label.entity-type')}
      options={options}
      searchKey="entity-type"
      selectedKeys={selectedKeys}
      onChange={(selected) =>
        onFiltersChange({
          ...filters,
          entityTypes: selected.map((option) => option.key),
        })
      }
      onGetInitialOptions={() => setSearch('')}
      onSearch={(value) => setSearch(value)}
    />
  );
};

/**
 * Relationship Type dropdown — same FilterSelectDropdown shell, each row
 * labelled `<Family> · <Predicate>` where the family comes from
 * {@link classifyRelation} (Lineage, Structure, Ontology, …).
 */
const RelationshipTypePicker = ({
  filters,
  filterOptions,
  onFiltersChange,
}: PickerProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const options = useMemo<SearchDropdownOption[]>(() => {
    const filtered = (filterOptions?.relationshipTypes ?? []).filter((item) =>
      item.label.toLowerCase().includes(search.toLowerCase())
    );
    const sections: KnowledgeGraphRelationshipGroupSection[] =
      groupRelationshipTypeChoices(filtered);

    return flattenSections(sections, t);
  }, [filterOptions?.relationshipTypes, search, t]);
  const selectedKeys = useMemo(
    () => toSelectedOptions(filters.relationshipTypes, options),
    [filters.relationshipTypes, options]
  );

  return (
    <FilterSelectDropdown
      immediateApply
      showSelectAll
      label={t('label.relationship-type')}
      options={options}
      searchKey="relationship-type"
      selectedKeys={selectedKeys}
      onChange={(selected) =>
        onFiltersChange({
          ...filters,
          relationshipTypes: selected.map((option) => option.key),
        })
      }
      onGetInitialOptions={() => setSearch('')}
      onSearch={(value) => setSearch(value)}
    />
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
  ontology,
  viewport,
  onPresentationChange,
  onToggleBands,
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
        <EntityTypePicker
          filterOptions={filterOptions}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
        <RelationshipTypePicker
          filterOptions={filterOptions}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
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

          {hasFilters && (
            <Button color="link-gray" size="sm" onPress={onClearFilters}>
              {t('label.clear-filter-plural')}
            </Button>
          )}
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
    </Box>
  );
};

export default KnowledgeGraphToolbar;
