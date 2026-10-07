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
  ButtonGroup,
  ButtonGroupItem,
  Dropdown,
  Popover,
  PopoverTrigger,
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
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, xor } from 'lodash';
import React, { FC, useCallback, useMemo, useState } from 'react';
import type { Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { ReactComponent as Layers } from '../../../../assets/svg/ic-layers.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-table.svg';
import { ReactComponent as ServiceView } from '../../../../assets/svg/services.svg';
import { SERVICE_TYPES } from '../../../../constants/Services.constant';
import { EntityType } from '../../../../enums/entity.enum';
import {
  LineageBand,
  LineageLens,
} from '../../../../generated/api/lineage/lineageScene';
import { Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import { LineagePlatformView } from '../../../../hooks/lineage/types';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import { AssetsUnion } from '../../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { LineageLayersProps } from './LineageLayers.interface';

const LAYER_BUTTON_CLASSES = [
  'tw:flex-col tw:gap-1 tw:px-4 tw:py-2 tw:text-[10px] tw:font-medium tw:text-primary',
  'tw:whitespace-normal tw:break-words tw:hover:after:outline-brand tw:hover:z-10',
  'tw:selected:bg-brand-primary tw:selected:text-primary',
].join(' ');

const SCENE_LENS_OPTIONS = [
  LineageLens.Service,
  LineageLens.Domain,
  LineageLens.DataProduct,
];

const SCENE_LENS_ICONS = {
  [LineageLens.Service]: Dataflow03,
  [LineageLens.Domain]: Globe01,
  [LineageLens.DataProduct]: Package,
};

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

const getLegacyLayerVisibility = (
  entityType: LineageLayersProps['entityType'],
  entity: LineageLayersProps['entity'],
  isPlatformLineage: boolean
) => {
  const isServiceType = SERVICE_TYPES.includes(entityType as AssetsUnion);
  const hasDomainContext = Boolean(
    entityType && entityType !== EntityType.DOMAIN
  );

  return {
    showColumnAndObservability: Boolean(entityType && !isServiceType),
    showService: isPlatformLineage || !isServiceType,
    showDomain:
      isPlatformLineage || (hasDomainContext && !isEmpty(entity?.domains)),
    showDataProduct:
      isPlatformLineage ||
      (hasDomainContext && !isEmpty((entity as Table)?.dataProducts)),
  };
};

const LayerMenuOption = ({
  icon: Icon,
  title,
  description,
  isSelected,
}: {
  icon: FC<{ className?: string }>;
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
  sceneBand,
  sceneLens,
  sceneLevelLabelKey,
  onSceneBandChange,
  onSceneLensChange,
}: LineageLayersProps) => {
  const {
    activeLayer,
    platformView,
    setPlatformView,
    isPlatformLineage,
    setActiveLayer,
  } = useLineageStore();
  const { t } = useTranslation();
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const hasSceneControls = Boolean(
    sceneBand && sceneLens && onSceneBandChange && onSceneLensChange
  );

  const handleLayerClick = useCallback(
    (layer: LineageLayer) => {
      if (activeLayer.indexOf(layer) === -1) {
        setActiveLayer([...activeLayer, layer]);
      } else {
        setActiveLayer(activeLayer.filter((value) => value !== layer));
      }
    },
    [activeLayer, setActiveLayer]
  );

  const handlePlatformViewChange = useCallback(
    (view: string) => {
      setPlatformView(
        platformView === view
          ? LineagePlatformView.None
          : (view as LineagePlatformView)
      );
    },
    [platformView, setPlatformView]
  );

  const handleSceneLensSelection = useCallback(
    (keys: Selection) => {
      if (keys === 'all') {
        return;
      }
      const [lens] = [...keys];
      if (lens && onSceneLensChange) {
        onSceneLensChange(lens as LineageLens);
        setIsLayersOpen(false);
      }
    },
    [onSceneLensChange]
  );

  const handleColumnLevelToggle = useCallback(
    (keys: Selection) => {
      const showColumns = keys === 'all' || keys.has(LineageBand.Field);
      onSceneBandChange?.(showColumns ? LineageBand.Field : LineageBand.Asset);
      setIsLayersOpen(false);
    },
    [onSceneBandChange]
  );

  const {
    showColumnAndObservability,
    showService,
    showDomain,
    showDataProduct,
  } = getLegacyLayerVisibility(entityType, entity, isPlatformLineage);

  const { layerButtons, renderedValues } = useMemo(() => {
    const buttons = [];
    const values: string[] = [];

    if (showColumnAndObservability) {
      values.push(
        LineageLayer.ColumnLevelLineage,
        LineageLayer.DataObservability
      );
      buttons.push(
        <ButtonGroupItem
          className={LAYER_BUTTON_CLASSES}
          data-testid="lineage-layer-column-btn"
          id={LineageLayer.ColumnLevelLineage}
          key={LineageLayer.ColumnLevelLineage}>
          <TableIcon className="tw:size-5" />
          {t('label.column')}
        </ButtonGroupItem>,
        <ButtonGroupItem
          className={LAYER_BUTTON_CLASSES}
          data-testid="lineage-layer-observability-btn"
          id={LineageLayer.DataObservability}
          key={LineageLayer.DataObservability}>
          <DataQualityIcon className="tw:size-5" />
          {t('label.observability')}
        </ButtonGroupItem>
      );
    }

    if (showService) {
      values.push(LineagePlatformView.Service);
      buttons.push(
        <ButtonGroupItem
          className={LAYER_BUTTON_CLASSES}
          data-testid="lineage-layer-service-btn"
          id={LineagePlatformView.Service}
          key={LineagePlatformView.Service}>
          <ServiceView className="tw:size-5" />
          {t('label.service')}
        </ButtonGroupItem>
      );
    }

    if (showDomain) {
      values.push(LineagePlatformView.Domain);
      buttons.push(
        <ButtonGroupItem
          className={LAYER_BUTTON_CLASSES}
          data-testid="lineage-layer-domain-btn"
          id={LineagePlatformView.Domain}
          key={LineagePlatformView.Domain}>
          <DomainIcon className="tw:size-5" />
          {t('label.domain')}
        </ButtonGroupItem>
      );
    }

    if (showDataProduct) {
      values.push(LineagePlatformView.DataProduct);
      buttons.push(
        <ButtonGroupItem
          className={LAYER_BUTTON_CLASSES}
          data-testid="lineage-layer-data-product-btn"
          id={LineagePlatformView.DataProduct}
          key={LineagePlatformView.DataProduct}>
          <DataProductIcon className="tw:size-5" />
          {t('label.data-product')}
        </ButtonGroupItem>
      );
    }

    return { layerButtons: buttons, renderedValues: values };
  }, [t, showColumnAndObservability, showService, showDomain, showDataProduct]);

  const selectedKeys = useMemo(
    () =>
      new Set(
        [...activeLayer, platformView].filter((value) =>
          renderedValues.includes(value as string)
        )
      ),
    [activeLayer, platformView, renderedValues]
  );

  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      const nextSelection =
        keys === 'all' ? [...renderedValues] : [...keys].map(String);
      const [changed] = xor([...selectedKeys], nextSelection);

      if (changed) {
        if (
          Object.values(LineagePlatformView).includes(
            changed as LineagePlatformView
          )
        ) {
          handlePlatformViewChange(changed);
        } else {
          handleLayerClick(changed as LineageLayer);
        }
      }
    },
    [selectedKeys, renderedValues, handlePlatformViewChange, handleLayerClick]
  );

  // The scene map's Layers control picks the lens the hierarchy is grouped by,
  // which only the main Lineage page navigates.
  if (hasSceneControls && sceneLens) {
    // The main Lineage page picks the lens its hierarchy is grouped by; an
    // asset page has no hierarchy to navigate, only its column-level view.
    const menu = isPlatformLineage ? (
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
    ) : (
      <Dropdown.Menu
        aria-label={t('label.level')}
        disallowEmptySelection={false}
        selectedKeys={
          sceneBand === LineageBand.Field
            ? new Set([LineageBand.Field])
            : new Set<string>()
        }
        selectionMode="multiple"
        onSelectionChange={handleColumnLevelToggle}>
        <Dropdown.Section>
          <Dropdown.SectionHeader className={MENU_SECTION_HEADER_CLASSES}>
            {t('label.level')}
          </Dropdown.SectionHeader>
          <Dropdown.Item
            data-testid={`lineage-layer-band-${LineageBand.Field}`}
            id={LineageBand.Field}
            textValue={t('label.column-level')}>
            {({ isSelected }) => (
              <LayerMenuOption
                icon={Columns03}
                isSelected={isSelected}
                title={t('label.column-level')}
              />
            )}
          </Dropdown.Item>
        </Dropdown.Section>
      </Dropdown.Menu>
    );

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
                {t(sceneLevelLabelKey ?? getSceneLensLabelKey(sceneLens))}
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
  }

  return (
    <PopoverTrigger isOpen={isLayersOpen} onOpenChange={setIsLayersOpen}>
      <Button
        className={classNames(LAYER_BUTTON_CLASSES, 'tw:bg-surface', {
          'tw:after:outline-brand tw:z-10 tw:[&>svg]:text-fg-brand-primary':
            isLayersOpen,
        })}
        color="secondary"
        data-testid="lineage-layer-btn"
        iconLeading={<Layers className="tw:size-5" />}
        size="sm">
        {t('label.layer-plural')}
      </Button>
      <Popover className="lineage-layers-popover tw:z-50" placement="right">
        <ButtonGroup
          aria-label={t('label.layer-plural')}
          selectedKeys={selectedKeys}
          selectionMode="multiple"
          size="sm"
          onSelectionChange={handleSelectionChange}>
          {layerButtons}
        </ButtonGroup>
      </Popover>
    </PopoverTrigger>
  );
};

export default React.memo(LineageLayers);
