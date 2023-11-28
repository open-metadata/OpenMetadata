/*
 *  Copyright 2023 Collate.
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
import { Button, Input, Space } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from 'reactflow';
import { ReactComponent as IconControlMinus } from '../../../assets/svg/control-minus.svg';
import { ReactComponent as IconControlPlus } from '../../../assets/svg/control-plus.svg';
import { ReactComponent as IconFitView } from '../../../assets/svg/fitview.svg';
import {
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
  ZOOM_BUTTON_STEP,
  ZOOM_SLIDER_STEP,
  ZOOM_TRANSITION_DURATION,
} from '../../../constants/Lineage.constants';
import { CustomTasksDAGViewControlProps } from './CustomTasksDAGViewControl.interface';

const CustomTasksDAGViewControl = ({
  zoomValue,
  fitViewParams,
}: CustomTasksDAGViewControlProps) => {
  const { t } = useTranslation();
  const { fitView, zoomTo } = useReactFlow();
  const [zoom, setZoom] = useState<number>(zoomValue);

  const onZoomHandler = useCallback(
    (zoomLevel: number) => {
      zoomTo?.(zoomLevel, { duration: ZOOM_TRANSITION_DURATION });
    },
    [zoomTo]
  );
  const onZoomInHandler = useCallback(() => {
    setZoom((pre) => {
      const zoomInValue = pre < MAX_ZOOM_VALUE ? pre + ZOOM_BUTTON_STEP : pre;
      onZoomHandler(zoomInValue);

      return zoomInValue;
    });
  }, [onZoomHandler, setZoom]);

  const onZoomOutHandler = useCallback(() => {
    setZoom((pre) => {
      const zoomOutValue = pre > MIN_ZOOM_VALUE ? pre - ZOOM_BUTTON_STEP : pre;
      onZoomHandler(zoomOutValue);

      return zoomOutValue;
    });
  }, [onZoomHandler, setZoom]);

  const onFitViewHandler = useCallback(() => {
    fitView?.(fitViewParams);
  }, [fitView, fitViewParams]);

  const onRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const zoomValue = parseFloat(event.target.value);
    onZoomHandler(zoomValue);
    setZoom(zoomValue);
  };

  useEffect(() => {
    if (zoomValue !== zoom) {
      setZoom(zoomValue);
    }
  }, [zoomValue]);

  return (
    <Space
      className="justify-end w-full z-10 absolute top-1 right-1 bottom-full p-y-md"
      data-testid="custom-tasks-dag-view-control"
      size={16}>
      <div className="flow-control custom-control-fit-screen-button custom-control-zoom-slide items-center">
        <Button
          className="control-button p-y-0"
          data-testid="zoom-in-button"
          icon={<IconControlMinus width={12} />}
          type="text"
          onClick={onZoomOutHandler}
        />

        <Input
          className="border-none bg-transparent p-0"
          data-testid="zoom-slider"
          max={MAX_ZOOM_VALUE}
          min={MIN_ZOOM_VALUE}
          step={ZOOM_SLIDER_STEP}
          type="range"
          value={zoom}
          onChange={onRangeChange}
        />

        <Button
          className="control-button p-y-0"
          data-testid="zoom-out-button"
          icon={<IconControlPlus width={12} />}
          type="text"
          onClick={onZoomInHandler}
        />
      </div>
      <Button
        className="custom-control-fit-screen-button"
        data-testid="fit-to-screen"
        icon={
          <span className="anticon">
            <IconFitView width={16} />
          </span>
        }
        title={t('label.fit-to-screen')}
        onClick={onFitViewHandler}
      />
    </Space>
  );
};

export default CustomTasksDAGViewControl;
