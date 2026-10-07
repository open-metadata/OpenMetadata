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
  Box,
  Button,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Check,
  ChevronDown,
  Columns03,
  Dataflow03,
  Globe01,
  LayersThree01,
  Package,
  ShieldTick,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, xor } from 'lodash';
import React, { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import type { Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { SERVICE_TYPES } from '../../../../constants/Services.constant';
import { EntityType } from '../../../../enums/entity.enum';
import { LineageLens } from '../../../../generated/api/lineage/lineageScene';
import { Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import { LineagePlatformView } from '../../../../hooks/lineage/types';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import { AssetsUnion } from '../../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { LineageLayersProps } from './LineageLayers.interface';

type MenuIcon = FC<{ className?: string }>;

const SCENE_LENS_OPTIONS = [
  LineageLens.Service,
  LineageLens.Domain,
  LineageLens.DataProduct,
];

const SCENE_LENS_ICONS: Record<LineageLens, MenuIcon> = {
  [LineageLens.Service]: Dataflow03,
  [LineageLens.Domain]: Globe01,
  [LineageLens.DataProduct]: Package,
};

const ASSET_LAYER_OPTIONS: {
  key: LineageLayer | LineagePlatformView;
  icon: MenuIcon;
  labelKey: string;
  testId: string;
}[] = [
  {
    key: LineageLayer.ColumnLevelLineage,
    icon: Columns03,
    labelKey: 'label.column',
    testId: 'lineage-layer-column-btn',
  },
  {
    key: LineageLayer.DataObservability,
    icon: ShieldTick,
    labelKey: 'label.observability',
    testId: 'lineage-layer-observability-btn',
  },
  {
    key: LineagePlatformView.Service,
    icon: Dataflow03,
    labelKey: 'label.service',
    testId: 'lineage-layer-service-btn',
  },
  {
    key: LineagePlatformView.Domain,
    icon: Globe01,
    labelKey: 'label.domain',
    testId: 'lineage-layer-domain-btn',
  },
  {
    key: LineagePlatformView.DataProduct,
    icon: Package,
    labelKey: 'label.data-product',
    testId: 'lineage-layer-data-product-btn',
  },
];

const getSceneLensLabelKey = (lens: LineageLens) => {
  switch (lens) {
    case LineageLens.Domain:
      return 'label.domain';
    case LineageLens.DataProduct:
      return 'label.data-product';
    default:
      return 'label.service-level-view';
  }
};

const getSceneLensDescriptionKey = (lens: LineageLens) => {
  switch (lens) {
    case LineageLens.Domain:
      return 'message.lineage-map-domain-lens-description';
    case LineageLens.DataProduct:
      return 'message.lineage-map-data-product-lens-description';
    default:
      return 'message.lineage-map-service-lens-description';
  }
};

const getAssetLayerKeys = (
  entityType: LineageLayersProps['entityType'],
  entity: LineageLayersProps['entity']
) => {
  const isServiceType = SERVICE_TYPES.includes(entityType as AssetsUnion);
  const hasDomainContext = Boolean(
    entityType && entityType !== EntityType.DOMAIN
  );
  const keys: string[] = [];

  if (entityType && !isServiceType) {
    keys.push(LineageLayer.ColumnLevelLineage, LineageLayer.DataObservability);
  }
  if (!isServiceType) {
    keys.push(LineagePlatformView.Service);
  }
  if (hasDomainContext && !isEmpty(entity?.domains)) {
    keys.push(LineagePlatformView.Domain);
  }
  if (hasDomainContext && !isEmpty((entity as Table)?.dataProducts)) {
    keys.push(LineagePlatformView.DataProduct);
  }

  return keys;
};

const LayerMenuOption = ({
  icon: Icon,
  title,
  description,
  isSelected,
}: {
  icon: MenuIcon;
  title: string;
  description?: string;
  isSelected: boolean;
}) => (
  <Box align="center" className="tw:w-full tw:whitespace-normal" gap={3}>
    <Box
      align="center"
      className={classNames('tw:size-[30px] tw:shrink-0 tw:rounded-lg', {
        'tw:bg-brand-solid tw:text-fg-white': isSelected,
        'tw:bg-tertiary tw:text-fg-tertiary': !isSelected,
      })}
      justify="center">
      <Icon aria-hidden="true" className="tw:size-[18px]" />
    </Box>
    <Box className="tw:min-w-0 tw:flex-1" direction="col">
      <Typography
        as="span"
        className={isSelected ? 'tw:text-brand-secondary' : 'tw:text-primary'}
        size="text-sm"
        weight={isSelected ? 'semibold' : 'medium'}>
        {title}
      </Typography>
      {description && (
        <Typography as="span" className="tw:text-quaternary" size="text-xs">
          {description}
        </Typography>
      )}
    </Box>
    {isSelected && (
      <Check
        aria-hidden="true"
        className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary"
      />
    )}
  </Box>
);

const MENU_SECTION_HEADER_CLASSES =
  'tw:px-3 tw:pt-1.5 tw:pb-1 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wider tw:text-quaternary';

const LineageLayers = ({
  entityType,
  entity,
  sceneLens,
  sceneLevelLabelKey,
  onSceneLensChange,
}: LineageLayersProps) => {
  const { activeLayer, platformView, setPlatformView, setActiveLayer } =
    useLineageStore();
  const { t } = useTranslation();
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  const assetLayerKeys = useMemo(
    () => getAssetLayerKeys(entityType, entity),
    [entityType, entity]
  );

  const assetSelectedKeys = useMemo(
    () =>
      new Set(
        [...activeLayer, platformView].filter((value) =>
          assetLayerKeys.includes(value)
        )
      ),
    [activeLayer, platformView, assetLayerKeys]
  );

  const handleSceneLensSelection = useCallback(
    (keys: Selection) => {
      const [lens] = keys === 'all' ? [] : [...keys];
      if (lens && onSceneLensChange) {
        onSceneLensChange(lens as LineageLens);
        setIsLayersOpen(false);
      }
    },
    [onSceneLensChange]
  );

  // Column and Observability are overlays; Service / Domain / Data Product
  // swap the graph for that container's lineage, one at a time.
  const handleAssetLayerChange = useCallback(
    (keys: Selection) => {
      const next = keys === 'all' ? assetLayerKeys : [...keys].map(String);
      const [changed] = xor([...assetSelectedKeys], next);
      if (!changed) {
        return;
      }
      if (
        Object.values(LineagePlatformView).includes(
          changed as LineagePlatformView
        )
      ) {
        setPlatformView(
          platformView === changed
            ? LineagePlatformView.None
            : (changed as LineagePlatformView)
        );

        return;
      }
      const layer = changed as LineageLayer;
      setActiveLayer(
        activeLayer.includes(layer)
          ? activeLayer.filter((value) => value !== layer)
          : [...activeLayer, layer]
      );
    },
    [
      activeLayer,
      assetLayerKeys,
      assetSelectedKeys,
      platformView,
      setActiveLayer,
      setPlatformView,
    ]
  );

  const isSceneMenu = Boolean(sceneLens && onSceneLensChange);
  let triggerLabel: ReactNode;
  let menu: ReactNode;

  if (sceneLens && isSceneMenu) {
    triggerLabel = t(sceneLevelLabelKey ?? getSceneLensLabelKey(sceneLens));
    menu = (
      <Dropdown.Menu
        disallowEmptySelection
        aria-label={t('label.lineage-layer')}
        selectedKeys={new Set([sceneLens])}
        selectionMode="single"
        onSelectionChange={handleSceneLensSelection}>
        <Dropdown.Section>
          <Dropdown.SectionHeader className={MENU_SECTION_HEADER_CLASSES}>
            {t('label.lineage-layer')}
          </Dropdown.SectionHeader>
          {SCENE_LENS_OPTIONS.map((lens) => (
            <Dropdown.Item
              data-testid={`lineage-layer-lens-${lens}`}
              id={lens}
              key={lens}
              textValue={t(getSceneLensLabelKey(lens))}>
              {({ isSelected }) => (
                <LayerMenuOption
                  description={t(getSceneLensDescriptionKey(lens))}
                  icon={SCENE_LENS_ICONS[lens]}
                  isSelected={isSelected}
                  title={t(getSceneLensLabelKey(lens))}
                />
              )}
            </Dropdown.Item>
          ))}
        </Dropdown.Section>
      </Dropdown.Menu>
    );
  } else {
    const assetOptions = ASSET_LAYER_OPTIONS.filter(({ key }) =>
      assetLayerKeys.includes(key)
    );
    const selectedLabels = assetOptions
      .filter(({ key }) => assetSelectedKeys.has(key))
      .map(({ labelKey }) => t(labelKey));
    triggerLabel = isEmpty(selectedLabels)
      ? t('label.none')
      : selectedLabels.join(', ');
    menu = (
      <Dropdown.Menu
        aria-label={t('label.lineage-layer')}
        disallowEmptySelection={false}
        selectedKeys={assetSelectedKeys}
        selectionMode="multiple"
        onSelectionChange={handleAssetLayerChange}>
        <Dropdown.Section>
          <Dropdown.SectionHeader className={MENU_SECTION_HEADER_CLASSES}>
            {t('label.lineage-layer')}
          </Dropdown.SectionHeader>
          {assetOptions.map(({ key, icon, labelKey, testId }) => (
            <Dropdown.Item
              data-testid={testId}
              id={key}
              key={key}
              textValue={t(labelKey)}>
              {({ isSelected }) => (
                <LayerMenuOption
                  icon={icon}
                  isSelected={isSelected}
                  title={t(labelKey)}
                />
              )}
            </Dropdown.Item>
          ))}
        </Dropdown.Section>
      </Dropdown.Menu>
    );
  }

  return (
    <Dropdown.Root isOpen={isLayersOpen} onOpenChange={setIsLayersOpen}>
      <Button
        className={classNames(
          'lineage-scene-layer-trigger tw:min-w-[232px] tw:justify-start! tw:gap-3! tw:rounded-xl! tw:bg-surface tw:px-3! tw:py-2! tw:text-left tw:shadow-md',
          { 'tw:after:outline-brand': isLayersOpen }
        )}
        color="secondary"
        data-testid="lineage-layer-btn"
        iconLeading={
          <Box
            align="center"
            className="tw:size-[38px] tw:shrink-0 tw:rounded-xl tw:bg-brand-primary tw:text-fg-brand-primary"
            justify="center">
            <LayersThree01 aria-hidden="true" className="tw:size-[22px]" />
          </Box>
        }
        size="sm">
        <Box direction="col">
          <Typography
            as="span"
            className="tw:uppercase tw:tracking-wider tw:text-quaternary"
            size="text-xs"
            weight="semibold">
            {t('label.layer-plural')}
          </Typography>
          <Box align="center" gap={1}>
            <Typography
              as="span"
              className="tw:whitespace-nowrap tw:text-primary"
              size="text-sm"
              weight="semibold">
              {triggerLabel}
            </Typography>
            <ChevronDown
              aria-hidden="true"
              className={classNames(
                'tw:size-3.5 tw:text-fg-tertiary tw:transition-transform',
                { 'tw:rotate-180': isLayersOpen }
              )}
            />
          </Box>
        </Box>
      </Button>
      <Dropdown.Popover
        className="lineage-layers-popover tw:w-auto tw:min-w-[264px] tw:p-1.5"
        placement="top start">
        {menu}
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default React.memo(LineageLayers);
