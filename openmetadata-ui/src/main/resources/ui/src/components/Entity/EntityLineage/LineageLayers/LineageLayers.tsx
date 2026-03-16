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
  ButtonGroup,
  ButtonGroupItem,
  Popover,
  PopoverTrigger,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isEmpty, xor } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { ReactComponent as Layers } from '../../../../assets/svg/ic-layers.svg';
import { ReactComponent as ServiceView } from '../../../../assets/svg/services.svg';
import { SERVICE_TYPES } from '../../../../constants/Services.constant';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import searchClassBase from '../../../../utils/SearchClassBase';
import { AssetsUnion } from '../../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import './lineage-layers.less';
import { LineageLayersProps } from './LineageLayers.interface';

const LineageLayers = ({ entityType, entity }: LineageLayersProps) => {
  const {
    activeLayer,
    platformView,
    setPlatformView,
    isPlatformLineage,
    setActiveLayer,
  } = useLineageStore();
  const { t } = useTranslation();
  const [isLayersOpen, setIsLayersOpen] = React.useState(false);
  const selectedValues = [...activeLayer, platformView];

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

  const handleSelectionChange = React.useCallback(
    (keys: Set<string | number>) => {
      const newSelection = [...keys] as (LineageLayer | LineagePlatformView)[];
      const newlyAdded = xor(selectedValues, newSelection)[0];

      if (!newlyAdded) {
        return;
      }

      if (
        Object.values(LineagePlatformView).includes(
          newlyAdded as LineagePlatformView
        )
      ) {
        setPlatformView(
          platformView === newlyAdded
            ? LineagePlatformView.None
            : (newlyAdded as LineagePlatformView)
        );
      } else {
        const layer = newlyAdded as LineageLayer;
        const index = activeLayer.indexOf(layer);

        if (index === -1) {
          setActiveLayer([...activeLayer, layer]);
        } else {
          setActiveLayer(activeLayer.filter((l) => l !== layer));
        }
      }
    },
    [selectedValues, activeLayer, platformView, setActiveLayer, setPlatformView]
  );

  const buttonContent = React.useMemo(() => {
    const buttons = [];

    if (showColumnAndObservability) {
      buttons.push([
        <ButtonGroupItem
          className="tw:flex-col tw:gap-1 tw:min-w-[80px]"
          data-testid="lineage-layer-column-btn"
          id={LineageLayer.ColumnLevelLineage}
          key={LineageLayer.ColumnLevelLineage}>
          {searchClassBase.getEntityIcon(EntityType.TABLE)}
          {t('label.column')}
        </ButtonGroupItem>,
        <ButtonGroupItem
          className="tw:flex-col tw:gap-1 tw:min-w-[80px]"
          data-testid="lineage-layer-observability-btn"
          id={LineageLayer.DataObservability}
          key={LineageLayer.DataObservability}>
          <DataQualityIcon />
          {t('label.observability')}
        </ButtonGroupItem>,
      ]);
    }

    if (showService) {
      buttons.push(
        <ButtonGroupItem
          className="tw:flex-col tw:gap-1 tw:min-w-[80px]"
          data-testid="lineage-layer-service-btn"
          id={LineagePlatformView.Service}
          key={LineagePlatformView.Service}>
          <ServiceView />
          {t('label.service')}
        </ButtonGroupItem>
      );
    }

    if (showDomain) {
      buttons.push(
        <ButtonGroupItem
          className="tw:flex-col tw:gap-1 tw:min-w-[80px]"
          data-testid="lineage-layer-domain-btn"
          id={LineagePlatformView.Domain}
          key={LineagePlatformView.Domain}>
          <DomainIcon />
          {t('label.domain')}
        </ButtonGroupItem>
      );
    }

    if (showDataProduct) {
      buttons.push(
        <ButtonGroupItem
          className="tw:flex-col tw:gap-1 tw:min-w-[80px]"
          data-testid="lineage-layer-data-product-btn"
          id={LineagePlatformView.DataProduct}
          key={LineagePlatformView.DataProduct}>
          <DataProductIcon />
          {t('label.data-product')}
        </ButtonGroupItem>
      );
    }

    return (
      <ButtonGroup
        selectedKeys={new Set(selectedValues)}
        selectionMode="multiple"
        onSelectionChange={handleSelectionChange}>
        {buttons}
      </ButtonGroup>
    );
  }, [
    selectedValues,
    activeLayer,
    platformView,
    handleSelectionChange,
    showColumnAndObservability,
    showService,
    showDomain,
    showDataProduct,
  ]);

  return (
    <>
      <PopoverTrigger isOpen={isLayersOpen} onOpenChange={setIsLayersOpen}>
        <button
          className={classNames('lineage-layer-btn', {
            highlight: isLayersOpen,
          })}
          data-testid="lineage-layer-btn">
          <Layers width={20} />
          {t('label.layer-plural')}
        </button>
        <Popover placement="right">{buttonContent}</Popover>
      </PopoverTrigger>
    </>
  );
};

export default React.memo(LineageLayers);
