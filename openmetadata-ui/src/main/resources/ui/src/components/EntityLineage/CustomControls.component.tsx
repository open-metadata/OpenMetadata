/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import React, { FC, HTMLAttributes, memo, useCallback, useState } from 'react';
import { FitViewParams, useZoomPanHelper } from 'react-flow-renderer';
import SVGIcons from '../../utils/SvgUtils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ControlButtonProps extends HTMLAttributes<HTMLButtonElement> {}

export interface ControlProps extends HTMLAttributes<HTMLDivElement> {
  showZoom?: boolean;
  showFitView?: boolean;
  fitViewParams?: FitViewParams;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
}

export const ControlButton: FC<ControlButtonProps> = ({
  children,
  className,
  ...rest
}) => (
  <button
    className={classNames('control-button', className)}
    draggable={false}
    type="button"
    {...rest}>
    {children}
  </button>
);

const CustomControls: FC<ControlProps> = ({
  style,
  showFitView = true,
  showZoom = true,
  fitViewParams,
  className,
  children,
}: ControlProps) => {
  const { fitView, zoomIn, zoomOut, zoomTo } = useZoomPanHelper();
  const [zoom, setZoom] = useState<number>(1.5);

  const onZoomInHandler = useCallback(() => {
    setZoom((pre) => (pre < 2.5 ? pre + 0.25 : pre));
    zoomIn?.();
  }, [zoomIn]);

  const onZoomOutHandler = useCallback(() => {
    setZoom((pre) => (pre > 0.5 ? pre - 0.25 : pre));
    zoomOut?.();
  }, [zoomOut]);

  const onFitViewHandler = useCallback(() => {
    fitView?.(fitViewParams);
  }, [fitView, fitViewParams]);

  const onZoomHandler = useCallback(
    (zoomLevel: number) => {
      zoomTo?.(zoomLevel);
    },
    [zoomTo]
  );

  return (
    <div
      className={classNames(
        'controls-container tw-flex tw-gap-x-2 tw-z-50',
        className
      )}
      style={style}>
      {showZoom && (
        <div className="flow-control tw-flex tw-gap-x-2 tw-bg-body-hover tw-border tw-border-tag tw-h-8 tw-shadow-md tw-rounded">
          <ControlButton
            className="tw-px-1 tw-cursor-pointer tw-w-8 tw-h-8"
            onClick={onZoomOutHandler}>
            <SVGIcons
              alt="minus-icon"
              className="tw--mt-0.5"
              icon="icon-control-minus"
              width="12"
            />
          </ControlButton>
          <input
            className="tw-mt-0.5 tw-bg-body-hover"
            max={2.5}
            min={0.5}
            step={0.1}
            type="range"
            value={zoom}
            onChange={(e) => {
              const zoomValue = parseFloat(e.target.value);
              onZoomHandler(zoomValue);
              setZoom(zoomValue);
            }}
          />
          <ControlButton
            className="tw-px-1 tw-cursor-pointer tw-w-8 tw-h-8"
            onClick={onZoomInHandler}>
            <SVGIcons
              alt="plus-icon"
              className="tw--mt-0.5"
              icon="icon-control-plus"
              width="12"
            />
          </ControlButton>
        </div>
      )}
      {showFitView && (
        <ControlButton
          className="tw-border tw-border-tag tw-rounded tw-px-1 tw-bg-body-main tw-shadow-md tw-cursor-pointer tw-w-8 tw-h-8"
          onClick={onFitViewHandler}>
          <SVGIcons alt="fitview-icon" icon="icon-fitview" width="16" />
        </ControlButton>
      )}
      {children}
    </div>
  );
};

export default memo(CustomControls);
