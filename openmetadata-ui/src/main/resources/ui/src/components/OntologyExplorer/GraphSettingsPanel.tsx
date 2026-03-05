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

import { Button, Dropdown, Toggle } from '@openmetadata/ui-core-components';
import { ChevronDown, Settings01 } from '@untitledui/icons';
import { Popover } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GraphSettings,
  LayoutAlgorithm,
  NodeColorMode,
  NodeSizeMode,
} from './OntologyExplorer.interface';

interface GraphSettingsPanelProps {
  settings: GraphSettings;
  onSettingsChange: (settings: GraphSettings) => void;
}

const GraphSettingsPanel: React.FC<GraphSettingsPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleLayoutChange = useCallback(
    (value: LayoutAlgorithm) => {
      onSettingsChange({ ...settings, layout: value });
    },
    [settings, onSettingsChange]
  );

  const handleNodeColorModeChange = useCallback(
    (value: NodeColorMode) => {
      onSettingsChange({ ...settings, nodeColorMode: value });
    },
    [settings, onSettingsChange]
  );

  const handleNodeSizeModeChange = useCallback(
    (value: NodeSizeMode) => {
      onSettingsChange({ ...settings, nodeSizeMode: value });
    },
    [settings, onSettingsChange]
  );

  const handleToggle = useCallback(
    (key: keyof GraphSettings, value: boolean) => {
      onSettingsChange({ ...settings, [key]: value });
    },
    [settings, onSettingsChange]
  );

  const layoutItems = useMemo(
    () => [
      { id: 'force' as const, label: t('label.force-directed') },
      { id: 'hierarchical' as const, label: t('label.hierarchical') },
      { id: 'radial' as const, label: t('label.radial') },
      { id: 'circular' as const, label: t('label.circular') },
    ],
    [t]
  );

  const nodeColorItems = useMemo(
    () => [
      { id: 'glossary' as const, label: t('label.by-glossary') },
      { id: 'relationType' as const, label: t('label.by-relation-type') },
      { id: 'hierarchyLevel' as const, label: t('label.by-hierarchy-level') },
      {
        id: 'connectionCount' as const,
        label: t('label.by-connection-count'),
      },
    ],
    [t]
  );

  const nodeSizeItems = useMemo(
    () => [
      { id: 'uniform' as const, label: t('label.uniform') },
      {
        id: 'connectionCount' as const,
        label: t('label.by-connection-count'),
      },
      { id: 'childCount' as const, label: t('label.by-child-count') },
    ],
    [t]
  );

  const popoverContent = (
    <div className="tw:min-w-55 tw:space-y-3 tw:py-0.5">
      <div className="tw:space-y-1">
        <div className="tw:text-xs tw:font-semibold tw:text-gray-500">
          {t('label.layout')}
        </div>
        <Dropdown.Root>
          <Button color="secondary" iconTrailing={ChevronDown} size="sm">
            {layoutItems.find((i) => i.id === settings.layout)?.label ??
              t('label.layout')}
          </Button>
          <Dropdown.Popover className="tw:min-w-45">
            <Dropdown.Menu
              items={layoutItems}
              onAction={(key) => handleLayoutChange(key as LayoutAlgorithm)}>
              {(item) => (
                <Dropdown.Item id={item.id} label={item.label ?? ''} />
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>

      <div className="tw:border-t tw:border-gray-200" />

      <div className="tw:space-y-1">
        <div className="tw:text-xs tw:font-semibold tw:text-gray-500">
          {t('label.node-color')}
        </div>
        <Dropdown.Root>
          <Button color="secondary" iconTrailing={ChevronDown} size="sm">
            {nodeColorItems.find((i) => i.id === settings.nodeColorMode)
              ?.label ?? t('label.node-color')}
          </Button>
          <Dropdown.Popover className="tw:min-w-45">
            <Dropdown.Menu
              items={nodeColorItems}
              onAction={(key) =>
                handleNodeColorModeChange(key as NodeColorMode)
              }>
              {(item) => (
                <Dropdown.Item id={item.id} label={item.label ?? ''} />
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>

      <div className="tw:space-y-1">
        <div className="tw:text-xs tw:font-semibold tw:text-gray-500">
          {t('label.node-size')}
        </div>
        <Dropdown.Root>
          <Button color="secondary" iconTrailing={ChevronDown} size="sm">
            {nodeSizeItems.find((i) => i.id === settings.nodeSizeMode)?.label ??
              t('label.node-size')}
          </Button>
          <Dropdown.Popover className="tw:min-w-45">
            <Dropdown.Menu
              items={nodeSizeItems}
              onAction={(key) => handleNodeSizeModeChange(key as NodeSizeMode)}>
              {(item) => (
                <Dropdown.Item id={item.id} label={item.label ?? ''} />
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>

      <div className="tw:border-t tw:border-gray-200" />

      <div className="tw:flex tw:flex-col tw:gap-1.5">
        <Toggle
          isSelected={settings.showEdgeLabels}
          label={t('label.edge-labels')}
          size="sm"
          onChange={(checked) => handleToggle('showEdgeLabels', checked)}
        />
        <Toggle
          isSelected={settings.showMetrics}
          label={t('label.include-entity', {
            entity: t('label.metric-plural'),
          })}
          size="sm"
          onChange={(checked) => handleToggle('showMetrics', checked)}
        />
        <Toggle
          isSelected={settings.showGlossaryHulls}
          label={`${t('label.glossary')} ${t('label.group')}`}
          size="sm"
          onChange={(checked) => handleToggle('showGlossaryHulls', checked)}
        />
        <Toggle
          isSelected={settings.edgeBundling}
          label={t('label.edge-bundling')}
          size="sm"
          onChange={(checked) => handleToggle('edgeBundling', checked)}
        />
        <Toggle
          isSelected={settings.highlightOnHover}
          label={t('label.highlight-on-hover')}
          size="sm"
          onChange={(checked) => handleToggle('highlightOnHover', checked)}
        />
        <Toggle
          isSelected={settings.animateTransitions}
          label={t('label.animate-transitions')}
          size="sm"
          onChange={(checked) => handleToggle('animateTransitions', checked)}
        />
        <Toggle
          isSelected={settings.physicsEnabled}
          label={t('label.physics-simulation')}
          size="sm"
          onChange={(checked) => handleToggle('physicsEnabled', checked)}
        />
      </div>
    </div>
  );

  return (
    <div>
      <Popover
        content={popoverContent}
        open={open}
        placement="bottomRight"
        trigger="click"
        onOpenChange={setOpen}>
        <Button
          color="secondary"
          data-testid="ontology-graph-settings"
          iconLeading={<Settings01 height={20} width={20} />}
          size="sm">
          {t('label.setting-plural')}
        </Button>
      </Popover>
    </div>
  );
};

export default GraphSettingsPanel;
