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
import React, { FC, useMemo, useState } from 'react';
import type { Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { ReactComponent as Layers } from '../../../../assets/svg/ic-layers.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-table.svg';
import { ReactComponent as ServiceView } from '../../../../assets/svg/services.svg';
import { SERVICE_TYPES } from '../../../../constants/Services.constant';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import { AssetsUnion } from '../../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { LineageLayersProps } from './LineageLayers.interface';

const LAYER_BUTTON_CLASSES = [
  'tw:flex-col tw:gap-1 tw:px-4 tw:py-2 tw:text-[10px] tw:font-medium tw:text-primary',
  'tw:whitespace-normal tw:break-words tw:hover:ring-brand tw:hover:z-10',
  'tw:selected:bg-brand-primary tw:selected:text-primary',
].join(' ');

const LineageLayers = ({ entityType, entity }: LineageLayersProps) => {
  const {
    activeLayer,
    platformView,
    setPlatformView,
    isPlatformLineage,
    setActiveLayer,
  } = useLineageStore();
  const { t } = useTranslation();
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  const handleLayerClick = React.useCallback(
    (layer: LineageLayer) => {
      if (activeLayer.indexOf(layer) === -1) {
        setActiveLayer([...activeLayer, layer]);
      } else {
        setActiveLayer(activeLayer.filter((value) => value !== layer));
      }
    },
    [activeLayer, setActiveLayer]
  );

  const handlePlatformViewChange = React.useCallback(
    (view: string) => {
      setPlatformView(
        platformView === view
          ? LineagePlatformView.None
          : (view as LineagePlatformView)
      );
    },
    [platformView, setPlatformView]
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

  const handleSelectionChange = React.useCallback(
    (keys: Selection) => {
      const nextSelection = [...(keys as Set<string>)];
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
    [selectedKeys, handlePlatformViewChange, handleLayerClick]
  );

  return (
    <PopoverTrigger isOpen={isLayersOpen} onOpenChange={setIsLayersOpen}>
      <Button
        className={classNames(LAYER_BUTTON_CLASSES, 'tw:bg-primary', {
          'tw:ring-brand tw:z-10 tw:[&>svg]:text-fg-brand-primary':
            isLayersOpen,
        })}
        color="secondary"
        data-testid="lineage-layer-btn"
        iconLeading={Layers as FC<{ className?: string }>}
        size="sm">
        {t('label.layer-plural')}
      </Button>
      <Popover placement="right">
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
