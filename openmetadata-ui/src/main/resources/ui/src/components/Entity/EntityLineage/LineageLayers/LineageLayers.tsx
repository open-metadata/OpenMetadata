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
  ButtonGroup,
  ButtonGroupItem,
  Popover,
  PopoverTrigger,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isEmpty, xor } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import type { Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropdownIcon } from '../../../../assets/svg/drop-down.svg';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/ic-check.svg';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { ReactComponent as Layers } from '../../../../assets/svg/ic-layers.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-table.svg';
import { ReactComponent as ServiceView } from '../../../../assets/svg/services.svg';
import { SERVICE_TYPES } from '../../../../constants/Services.constant';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import {
  LineageBand,
  LineageLens,
} from '../../../../generated/api/lineage/lineageScene';
import { Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import { AssetsUnion } from '../../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { LineageLayersProps } from './LineageLayers.interface';

const LAYER_BUTTON_CLASSES = [
  'tw:flex-col tw:gap-1 tw:px-4 tw:py-2 tw:text-[10px] tw:font-medium tw:text-primary',
  'tw:whitespace-normal tw:break-words tw:hover:after:outline-brand tw:hover:z-10',
  'tw:selected:bg-brand-primary tw:selected:text-primary',
].join(' ');

const SCENE_LAYER_MENU_OPTION_CLASSES = [
  'lineage-scene-layer-menu-option tw:grid! tw:w-full! tw:grid-cols-[34px_minmax(0,1fr)_16px]',
  'tw:items-center tw:justify-start! tw:gap-2.5! tw:rounded-lg! tw:px-3! tw:py-2! tw:text-left',
  'tw:whitespace-normal! tw:after:outline-transparent tw:selected:bg-brand-primary tw:selected:text-brand-tertiary',
  'tw:[&[data-selected]_.lineage-scene-layer-menu-icon]:bg-brand-solid',
  'tw:[&[data-selected]_.lineage-scene-layer-menu-icon]:text-fg-white',
].join(' ');

const SCENE_LAYER_MENU_ICON_CLASSES =
  'lineage-scene-layer-menu-icon tw:size-[34px] tw:rounded-lg tw:bg-tertiary tw:p-2 tw:text-fg-secondary';

const SCENE_LAYER_TRIGGER_CLASSES = [
  'lineage-scene-layer-trigger tw:flex! tw:min-h-[62px] tw:min-w-[248px] tw:items-center',
  'tw:justify-start! tw:gap-2.5! tw:rounded-xl! tw:bg-primary tw:px-3! tw:py-2! tw:text-left tw:shadow-lg',
  'tw:[&>[data-text]]:min-w-0 tw:[&>[data-text]]:flex-1 tw:[&>[data-text]]:p-0',
].join(' ');

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

const getSceneBandLabelKey = (band: LineageBand) => {
  switch (band) {
    case LineageBand.Layer:
      return 'label.lineage-map-layer-view';
    case LineageBand.Field:
      return 'label.field-level-lineage';
    default:
      return 'label.data-asset-plural';
  }
};

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

  const handleSceneBandSelection = useCallback(
    (keys: Selection) => {
      if (keys === 'all') {
        return;
      }
      const [band] = [...keys];
      if (band && onSceneBandChange) {
        onSceneBandChange(band as LineageBand);
        setIsLayersOpen(false);
      }
    },
    [onSceneBandChange]
  );

  const isServiceType = SERVICE_TYPES.includes(entityType as AssetsUnion);
  const showColumnAndObservability = entityType && !isServiceType;
  const showService = isPlatformLineage || !isServiceType;
  const showDomain =
    isPlatformLineage ||
    (entityType &&
      entityType !== EntityType.DOMAIN &&
      !isEmpty(entity?.domains));
  const showDataProduct =
    isPlatformLineage ||
    (entityType &&
      entityType !== EntityType.DOMAIN &&
      ((entity as Table)?.dataProducts ?? []).length > 0);

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

  const sceneControls = useMemo(() => {
    if (!hasSceneControls || !sceneLens || !sceneBand) {
      return null;
    }

    const sceneLensOptions = [
      LineageLens.Service,
      LineageLens.Domain,
      LineageLens.DataProduct,
    ];
    const sceneBandOptions = [
      LineageBand.Layer,
      LineageBand.Asset,
      LineageBand.Field,
    ];

    return (
      <div className="lineage-scene-layer-menu tw:flex tw:min-w-[320px] tw:flex-col tw:gap-2.5 tw:px-2.5 tw:pt-3.5 tw:pb-2.5">
        <div className="lineage-scene-layer-menu-section tw:flex tw:flex-col tw:gap-1.5">
          <span className="lineage-scene-layer-menu-title tw:px-3.5 tw:text-xs tw:font-bold tw:leading-4 tw:text-quaternary tw:uppercase">
            {t('label.lineage-layer')}
          </span>
          <ButtonGroup
            disallowEmptySelection
            aria-label={t('label.lineage-layer')}
            className="lineage-scene-layer-menu-options tw:m-0 tw:flex! tw:w-full! tw:flex-col! tw:gap-1.5! tw:space-x-0! tw:shadow-none!"
            selectedKeys={new Set([sceneLens])}
            size="sm"
            onSelectionChange={handleSceneLensSelection}>
            {sceneLensOptions.map((lens) => (
              <ButtonGroupItem
                className={SCENE_LAYER_MENU_OPTION_CLASSES}
                data-testid={`lineage-layer-lens-${lens}`}
                id={lens}
                key={lens}>
                {lens === LineageLens.Domain ? (
                  <DomainIcon className={SCENE_LAYER_MENU_ICON_CLASSES} />
                ) : lens === LineageLens.DataProduct ? (
                  <DataProductIcon className={SCENE_LAYER_MENU_ICON_CLASSES} />
                ) : (
                  <ServiceView className={SCENE_LAYER_MENU_ICON_CLASSES} />
                )}
                <span className="lineage-scene-layer-menu-copy tw:flex tw:min-w-0 tw:flex-col">
                  <span className="lineage-scene-layer-menu-option-title tw:text-sm tw:font-bold tw:leading-5 tw:text-primary">
                    {t(getSceneLensLabelKey(lens))}
                  </span>
                  <span className="lineage-scene-layer-menu-option-description tw:text-xs tw:font-medium tw:leading-4.5 tw:text-tertiary">
                    {t(getSceneLensDescriptionKey(lens))}
                  </span>
                </span>
                {sceneLens === lens && (
                  <CheckIcon className="lineage-scene-layer-menu-check tw:size-4 tw:text-fg-brand-primary" />
                )}
              </ButtonGroupItem>
            ))}
          </ButtonGroup>
        </div>

        <div className="lineage-scene-layer-menu-section tw:flex tw:flex-col tw:gap-1.5 tw:border-t tw:border-secondary tw:pt-2.5">
          <span className="lineage-scene-layer-menu-title tw:px-3.5 tw:text-xs tw:font-bold tw:leading-4 tw:text-quaternary tw:uppercase">
            {t('label.level')}
          </span>
          <ButtonGroup
            disallowEmptySelection
            aria-label={t('label.level')}
            className="lineage-scene-layer-menu-options tw:m-0 tw:flex! tw:w-full! tw:flex-col! tw:gap-1.5! tw:space-x-0! tw:shadow-none!"
            selectedKeys={new Set([sceneBand])}
            size="sm"
            onSelectionChange={handleSceneBandSelection}>
            {sceneBandOptions.map((band) => (
              <ButtonGroupItem
                className={SCENE_LAYER_MENU_OPTION_CLASSES}
                data-testid={`lineage-layer-band-${band}`}
                id={band}
                key={band}>
                {band === LineageBand.Layer ? (
                  <Layers className={SCENE_LAYER_MENU_ICON_CLASSES} />
                ) : (
                  <TableIcon className={SCENE_LAYER_MENU_ICON_CLASSES} />
                )}
                <span className="lineage-scene-layer-menu-copy tw:flex tw:min-w-0 tw:flex-col">
                  <span className="lineage-scene-layer-menu-option-title tw:text-sm tw:font-bold tw:leading-5 tw:text-primary">
                    {t(getSceneBandLabelKey(band))}
                  </span>
                </span>
                {sceneBand === band && (
                  <CheckIcon className="lineage-scene-layer-menu-check tw:size-4 tw:text-fg-brand-primary" />
                )}
              </ButtonGroupItem>
            ))}
          </ButtonGroup>
        </div>
      </div>
    );
  }, [
    handleSceneBandSelection,
    handleSceneLensSelection,
    hasSceneControls,
    sceneBand,
    sceneLens,
    t,
  ]);

  const trigger =
    hasSceneControls && sceneLens ? (
      <Button
        className={classNames(SCENE_LAYER_TRIGGER_CLASSES, {
          'tw:after:outline-brand': isLayersOpen,
        })}
        color="secondary"
        data-testid="lineage-layer-btn"
        iconLeading={
          <Layers className="lineage-scene-layer-trigger-icon tw:size-[42px] tw:shrink-0 tw:rounded-xl tw:bg-brand-primary tw:p-2.5 tw:text-fg-brand-primary" />
        }
        iconTrailing={
          <DropdownIcon className="lineage-scene-layer-trigger-caret tw:ml-auto tw:size-3" />
        }
        size="sm">
        <span className="lineage-scene-layer-trigger-label tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
          <span className="lineage-scene-layer-trigger-eyebrow tw:text-xs tw:font-bold tw:leading-4 tw:text-quaternary tw:uppercase">
            {t('label.layer-plural')}
          </span>
          <span className="lineage-scene-layer-trigger-value tw:text-sm tw:font-bold tw:leading-5 tw:text-primary">
            {t(sceneLevelLabelKey ?? getSceneLensLabelKey(sceneLens))}
          </span>
        </span>
      </Button>
    ) : (
      <Button
        className={classNames(LAYER_BUTTON_CLASSES, 'tw:bg-primary', {
          'tw:after:outline-brand tw:z-10 tw:[&>svg]:text-fg-brand-primary':
            isLayersOpen,
        })}
        color="secondary"
        data-testid="lineage-layer-btn"
        iconLeading={<Layers className="tw:size-5" />}
        size="sm">
        {t('label.layer-plural')}
      </Button>
    );

  return (
    <PopoverTrigger isOpen={isLayersOpen} onOpenChange={setIsLayersOpen}>
      {trigger}
      <Popover
        className="lineage-layers-popover tw:z-50"
        placement={hasSceneControls ? 'top' : 'right'}>
        {sceneControls ?? (
          <ButtonGroup
            aria-label={t('label.layer-plural')}
            selectedKeys={selectedKeys}
            selectionMode="multiple"
            size="sm"
            onSelectionChange={handleSelectionChange}>
            {layerButtons}
          </ButtonGroup>
        )}
      </Popover>
    </PopoverTrigger>
  );
};

export default React.memo(LineageLayers);
