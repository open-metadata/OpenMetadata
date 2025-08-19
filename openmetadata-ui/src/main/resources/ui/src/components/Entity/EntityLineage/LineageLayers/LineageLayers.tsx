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
import { Button, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { ReactComponent as Layers } from '../../../../assets/svg/ic-layers.svg';
import { ReactComponent as ServiceView } from '../../../../assets/svg/services.svg';
import { SERVICE_TYPES } from '../../../../constants/Services.constant';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import searchClassBase from '../../../../utils/SearchClassBase';
import { Popover } from '../../../common/AntdCompat';
import { AssetsUnion } from '../../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import './lineage-layers.less';
import {
    LayerButtonProps,
    LineageLayersProps
} from './LineageLayers.interface';
;

const LayerButton: React.FC<LayerButtonProps> = React.memo(
  ({ isActive, onClick, icon, label, testId }) => (
    <Button
      className={classNames('lineage-layer-button h-15', {
        active: isActive,
      })}
      data-testid={testId}
      onClick={onClick}>
      <div className="lineage-layer-btn">
        <div className="layer-icon">{icon}</div>
        <Typography.Text className="text-xss">{label}</Typography.Text>
      </div>
    </Button>
  )
);

const LineageLayers = ({ entityType, entity }: LineageLayersProps) => {
  const {
    activeLayer,
    onUpdateLayerView,
    isEditMode,
    onPlatformViewChange,
    platformView,
    isPlatformLineage,
  } = useLineageProvider();
  const { t } = useTranslation();

  const handleLayerClick = React.useCallback(
    (value: LineageLayer) => {
      const index = activeLayer.indexOf(value);
      if (index === -1) {
        onUpdateLayerView([...activeLayer, value]);
      } else {
        onUpdateLayerView(activeLayer.filter((layer) => layer !== value));
      }
    },
    [activeLayer, onUpdateLayerView]
  );

  const handlePlatformViewChange = React.useCallback(
    (view: LineagePlatformView) => {
      onPlatformViewChange(
        platformView === view ? LineagePlatformView.None : view
      );
    },
    [platformView, onPlatformViewChange]
  );

  const buttonContent = React.useMemo(
    () => (
      <ButtonGroup>
        {entityType && !SERVICE_TYPES.includes(entityType as AssetsUnion) && (
          <>
            <LayerButton
              icon={searchClassBase.getEntityIcon(EntityType.TABLE)}
              isActive={activeLayer.includes(LineageLayer.ColumnLevelLineage)}
              label={t('label.column')}
              testId="lineage-layer-column-btn"
              onClick={() => handleLayerClick(LineageLayer.ColumnLevelLineage)}
            />
            <LayerButton
              icon={<DataQualityIcon />}
              isActive={activeLayer.includes(LineageLayer.DataObservability)}
              label={t('label.observability')}
              testId="lineage-layer-observability-btn"
              onClick={() => handleLayerClick(LineageLayer.DataObservability)}
            />
          </>
        )}

        {(isPlatformLineage ||
          (entityType &&
            !SERVICE_TYPES.includes(entityType as AssetsUnion))) && (
          <LayerButton
            icon={<ServiceView />}
            isActive={platformView === LineagePlatformView.Service}
            label={t('label.service')}
            testId="lineage-layer-service-btn"
            onClick={() =>
              handlePlatformViewChange(LineagePlatformView.Service)
            }
          />
        )}

        {(isPlatformLineage ||
          (entityType &&
            entityType !== EntityType.DOMAIN &&
            !isEmpty(entity?.domains))) && (
          <LayerButton
            icon={<DomainIcon />}
            isActive={platformView === LineagePlatformView.Domain}
            label={t('label.domain')}
            testId="lineage-layer-domain-btn"
            onClick={() => handlePlatformViewChange(LineagePlatformView.Domain)}
          />
        )}

        {(isPlatformLineage ||
          (entityType &&
            entityType !== EntityType.DOMAIN &&
            ((entity as Table)?.dataProducts ?? [])?.length > 0)) && (
          <LayerButton
            icon={<DataProductIcon />}
            isActive={platformView === LineagePlatformView.DataProduct}
            label={t('label.data-product')}
            testId="lineage-layer-data-product-btn"
            onClick={() =>
              handlePlatformViewChange(LineagePlatformView.DataProduct)
            }
          />
        )}
      </ButtonGroup>
    ),
    [
      activeLayer,
      platformView,
      entityType,
      handleLayerClick,
      handlePlatformViewChange,
      isPlatformLineage,
    ]
  );

  return (
    <Popover
      content={buttonContent}
      overlayClassName="lineage-layers-popover"
      placement="right"
      trigger="click">
      <Button
        ghost
        className={classNames('layers-btn h-15', {
          'layers-btn-edit-mode': isEditMode,
        })}
        data-testid="lineage-layer-btn"
        type="primary">
        <div className="lineage-layer-btn">
          <Layers width={20} />
          <Typography.Text className="text-xss">
            {t('label.layer-plural')}
          </Typography.Text>
        </div>
      </Button>
    </Popover>
  );
};

export default React.memo(LineageLayers);
