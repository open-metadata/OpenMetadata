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
  Divider,
  Dropdown,
  Slider,
  Tabs,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import type { FC } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ExportGraphPanel from '../OntologyExplorer/ExportGraphPanel';
import { ExportFormat } from '../OntologyExplorer/ExportGraphPanel.interface';
import { KnowledgeGraphToolbarProps } from './KnowledgeGraph.interface';

/**
 * The dropdown popover only mounts its search box when the user opens the
 * dropdown, so taking focus on mount is the behaviour they asked for — unlike
 * `autoFocus`, which steals focus on page load and is linted against.
 */
const focusOnMount = (node: HTMLInputElement | null): void => node?.focus();

/**
 * The dropdown listens for arrow/typeahead keys on its popover, which would
 * otherwise hijack typing in the search box.
 */
const stopKeydownPropagation = (e: React.KeyboardEvent): void =>
  e.stopPropagation();

// Borders are drawn with `border`/`outline`, never `ring`: rings compile to
// box-shadow, which WebKit does not pixel-snap, so they thin out at non-100%
// zoom.
const filterInputClassName =
  'tw:w-full tw:rounded-md tw:bg-primary tw:px-2.5 tw:py-1.5 tw:text-sm' +
  ' tw:text-primary tw:placeholder:text-placeholder tw:border' +
  ' tw:border-primary tw:focus:border-brand tw:focus:outline-2' +
  ' tw:focus:-outline-offset-2 tw:focus:outline-brand';

/**
 * Controls above the graph canvas: layout mode, entity- and relationship-type
 * filters, traversal depth, the edge-label toggle and export. Split out of
 * KnowledgeGraph so the component that owns the canvas is not also responsible
 * for the whole control surface.
 */
const KnowledgeGraphToolbar: FC<KnowledgeGraphToolbarProps> = ({
  entityDropdownOpen,
  entityFilterText,
  entityTypeOptions,
  filteredEntityTypeOptions,
  filteredRelationshipTypeOptions,
  hasActiveFilters,
  layout,
  relationshipDropdownOpen,
  relationshipFilterText,
  relationshipTypeOptions,
  selectedDepth,
  selectedEntityTypes,
  selectedRelationshipTypes,
  showEdgeLabels,
  onClearAll,
  onDepthChange,
  onEntityDropdownChange,
  onEntityFilterChange,
  onEntityTypeSelectionChange,
  onExportJsonLd,
  onExportPng,
  onExportTurtle,
  onLayoutChange,
  onRelationshipDropdownChange,
  onRelationshipFilterChange,
  onRelationshipTypeSelectionChange,
  onShowEdgeLabelsChange,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:p-sm tw:w-full"
      data-testid="knowledge-graph-controls"
      justify="between">
      <Box align="center" gap={4}>
        <Typography className="tw:text-secondary" weight="medium">
          {t('label.view-entity', { entity: t('label.mode') }) + ':'}
        </Typography>
        <Tabs
          className="tw:w-auto"
          data-testid="layout-tabs"
          selectedKey={layout}
          onSelectionChange={onLayoutChange}>
          <Tabs.List
            items={[
              {
                id: 'dagre',
                label: t('label.hierarchical'),
              },
              {
                id: 'radial',
                label: t('label.radial'),
              },
            ]}
            size="sm"
            type="button-minimal">
            {(tab) => <Tabs.Item {...tab} />}
          </Tabs.List>
        </Tabs>

        <Divider orientation="vertical" />
        <Dropdown.Root
          isOpen={entityDropdownOpen}
          onOpenChange={onEntityDropdownChange}>
          <Button
            color="secondary"
            isDisabled={entityTypeOptions.length === 0}
            size="sm">
            <Box align="center" gap={4}>
              {selectedEntityTypes.length > 0
                ? `${t('label.entity-type')} (${selectedEntityTypes.length})`
                : t('label.entity-type')}
              <ChevronDown
                aria-hidden="true"
                className="tw:size-4 tw:shrink-0 tw:stroke-[2.5px] tw:text-fg-quaternary"
              />
            </Box>
          </Button>
          <Dropdown.Popover>
            <div className="tw:border-b tw:border-border-secondary tw:px-4 tw:py-2">
              <input
                aria-label={t('label.entity-type')}
                className={filterInputClassName}
                placeholder={t('label.search')}
                ref={focusOnMount}
                type="text"
                value={entityFilterText}
                onChange={onEntityFilterChange}
                onKeyDown={stopKeydownPropagation}
              />
            </div>
            <Dropdown.Menu
              disallowEmptySelection={false}
              items={filteredEntityTypeOptions}
              selectedKeys={new Set(selectedEntityTypes)}
              selectionMode="multiple"
              onSelectionChange={onEntityTypeSelectionChange}>
              {(item) => (
                <Dropdown.Item
                  showCheckbox
                  id={item.id}
                  key={item.id}
                  label={item.label}
                />
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
        <Divider orientation="vertical" />
        <Dropdown.Root
          isOpen={relationshipDropdownOpen}
          onOpenChange={onRelationshipDropdownChange}>
          <Button
            color="secondary"
            isDisabled={relationshipTypeOptions.length === 0}
            size="sm">
            <Box align="center" gap={4}>
              {selectedRelationshipTypes.length > 0
                ? `${t('label.relationship-type')} (${
                    selectedRelationshipTypes.length
                  })`
                : t('label.relationship-type')}
              <ChevronDown
                aria-hidden="true"
                className="tw:size-4 tw:shrink-0 tw:stroke-[2.5px] tw:text-fg-quaternary"
              />
            </Box>
          </Button>
          <Dropdown.Popover>
            <div className="tw:border-b tw:border-border-secondary tw:px-4 tw:py-2">
              <input
                aria-label={t('label.relationship-type')}
                className={filterInputClassName}
                placeholder={t('label.search')}
                ref={focusOnMount}
                type="text"
                value={relationshipFilterText}
                onChange={onRelationshipFilterChange}
                onKeyDown={stopKeydownPropagation}
              />
            </div>
            <Dropdown.Menu
              disallowEmptySelection={false}
              items={filteredRelationshipTypeOptions}
              selectedKeys={new Set(selectedRelationshipTypes)}
              selectionMode="multiple"
              onSelectionChange={onRelationshipTypeSelectionChange}>
              {(item) => (
                <Dropdown.Item
                  showCheckbox
                  id={item.id}
                  key={item.id}
                  label={item.label}
                />
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
        <Divider orientation="vertical" />

        <Box align="center" gap={5}>
          <Typography className="depth-label">
            {t('label.node-depth') + ':'}
          </Typography>
          <Slider
            showHoverPreview
            showRange
            className="depth-slider"
            data-testid="depth-slider"
            labelPosition="top-floating"
            maxValue={5}
            minValue={1}
            rangeCount={5}
            step={1}
            style={{
              width: '150px',
            }}
            value={[selectedDepth]}
            onChange={onDepthChange}
          />
        </Box>
        <Divider orientation="vertical" />
        <Toggle
          data-testid="toggle-edge-labels"
          isSelected={showEdgeLabels}
          label={t('label.show-relationship-label-plural')}
          size="sm"
          onChange={onShowEdgeLabelsChange}
        />
        <Divider orientation="vertical" />
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

      {hasActiveFilters && (
        <Button color="link-gray" size="sm" onPress={onClearAll}>
          {t('label.clear-entity', { entity: t('label.all') })}
        </Button>
      )}
    </Box>
  );
};

export default KnowledgeGraphToolbar;
