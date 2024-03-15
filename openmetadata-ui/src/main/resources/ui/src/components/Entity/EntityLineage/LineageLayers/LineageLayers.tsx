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
import { Button, Popover, Radio, RadioChangeEvent, Typography } from 'antd';
import { t } from 'i18next';
import React from 'react';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as Layers } from '../../../../assets/svg/ic-layers.svg';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineageLayerView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { getEntityIcon } from '../../../../utils/TableUtils';
import './lineage-layers.less';

const LineageLayers = () => {
  const { activeLayer, onUpdateLayerView } = useLineageProvider();

  const onRadioChange = (e: RadioChangeEvent) => {
    onUpdateLayerView(e.target.value);
  };

  const content = (
    <Radio.Group size="large" value={activeLayer} onChange={onRadioChange}>
      <Radio.Button
        className="lineage-layer-radio-btn"
        value={LineageLayerView.COLUMN}>
        <div className="lineage-layer-btn h-15">
          <div className="d-flex w-5 h-5 text-base-color">
            {getEntityIcon(EntityType.TABLE)}
          </div>
          <Typography.Text className="text-xs text-color-inherit">
            {t('label.column')}
          </Typography.Text>
        </div>
      </Radio.Button>
      <Radio.Button
        className="lineage-layer-radio-btn"
        value={LineageLayerView.PIPELINE}>
        <div className="lineage-layer-btn h-15">
          <div className="d-flex w-5 h-5 text-base-color">
            {getEntityIcon(EntityType.PIPELINE)}
          </div>
          <Typography.Text className="text-xs text-color-inherit">
            {t('label.pipeline')}
          </Typography.Text>
        </div>
      </Radio.Button>
      <Radio.Button
        className="lineage-layer-radio-btn"
        value={LineageLayerView.DATA_QUALITY}>
        <div className="lineage-layer-btn h-15">
          <div className="d-flex w-5 h-5 text-base-color">
            <DataQualityIcon />
          </div>
          <Typography.Text className="text-xs text-color-inherit">
            {t('label.data-quality')}
          </Typography.Text>
        </div>
      </Radio.Button>
    </Radio.Group>
  );

  return (
    <Popover
      content={content}
      overlayClassName="lineage-layers-popover"
      placement="right"
      trigger="click">
      <Button ghost className="layers-btn h-15" type="primary">
        <div className="lineage-layer-btn">
          <Layers width={16} />
          <Typography.Text className="text-xs">
            {t('label.layer-plural')}
          </Typography.Text>
        </div>
      </Button>
    </Popover>
  );
};

export default LineageLayers;
