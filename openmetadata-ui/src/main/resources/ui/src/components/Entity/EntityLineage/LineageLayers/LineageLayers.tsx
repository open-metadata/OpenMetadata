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
import { Button, Popover, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import classNames from 'classnames';
import { t } from 'i18next';
import React from 'react';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as Layers } from '../../../../assets/svg/ic-layers.svg';
import { ReactComponent as ServiceView } from '../../../../assets/svg/services.svg';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { LineageLayer } from '../../../../generated/settings/settings';
import searchClassBase from '../../../../utils/SearchClassBase';
import './lineage-layers.less';

const LineageLayers = () => {
  const {
    activeLayer,
    onUpdateLayerView,
    isEditMode,
    onPlatformViewChange,
    platformView,
  } = useLineageProvider();

  const onButtonClick = (value: LineageLayer) => {
    const index = activeLayer.indexOf(value);
    if (index === -1) {
      onUpdateLayerView([...activeLayer, value]);
    } else {
      onUpdateLayerView(activeLayer.filter((layer) => layer !== value));
    }
  };

  return (
    <Popover
      content={
        <ButtonGroup>
          <Button
            className={classNames('lineage-layer-button h-15', {
              active: activeLayer.includes(LineageLayer.ColumnLevelLineage),
            })}
            data-testid="lineage-layer-column-btn"
            onClick={() => onButtonClick(LineageLayer.ColumnLevelLineage)}>
            <div className="lineage-layer-btn">
              <div className="layer-icon">
                {searchClassBase.getEntityIcon(EntityType.TABLE)}
              </div>
              <Typography.Text className="text-xss">
                {t('label.column')}
              </Typography.Text>
            </div>
          </Button>
          <Button
            className={classNames('lineage-layer-button h-15', {
              active: activeLayer.includes(LineageLayer.DataObservability),
            })}
            data-testid="lineage-layer-observability-btn"
            onClick={() => onButtonClick(LineageLayer.DataObservability)}>
            <div className="lineage-layer-btn">
              <div className="layer-icon">
                <DataQualityIcon />
              </div>
              <Typography.Text className="text-xss">
                {t('label.observability')}
              </Typography.Text>
            </div>
          </Button>
          <Button
            className={classNames('lineage-layer-button h-15', {
              active: platformView === LineagePlatformView.Service,
            })}
            data-testid="lineage-layer-observability-btn"
            onClick={() =>
              onPlatformViewChange(
                platformView === LineagePlatformView.Service
                  ? LineagePlatformView.None
                  : LineagePlatformView.Service
              )
            }>
            <div className="lineage-layer-btn">
              <div className="layer-icon">
                <ServiceView />
              </div>
              <Typography.Text className="text-xss">
                {t('label.service')}
              </Typography.Text>
            </div>
          </Button>
        </ButtonGroup>
      }
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

export default LineageLayers;
