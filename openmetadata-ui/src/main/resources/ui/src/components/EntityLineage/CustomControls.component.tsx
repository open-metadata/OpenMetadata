/*
 *  Copyright 2022 Collate.
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

import { SettingOutlined } from '@ant-design/icons';
import { Button, Col, Row, Select, Space } from 'antd';
import classNames from 'classnames';
import { PRIMERY_COLOR } from 'constants/constants';
import React, {
  ButtonHTMLAttributes,
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from 'reactflow';
import { getEntityName } from 'utils/EntityUtils';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import {
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
  ZOOM_BUTTON_STEP,
  ZOOM_SLIDER_STEP,
  ZOOM_TRANSITION_DURATION,
} from '../../constants/Lineage.constants';
import { getLoadingStatusValue } from '../../utils/EntityLineageUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { ControlProps, LineageConfig } from './EntityLineage.interface';
import LineageConfigModal from './LineageConfigModal';
import { ReactComponent as ExitFullScreen } from '/assets/svg/exit-full-screen.svg';
import { ReactComponent as FullScreen } from '/assets/svg/full-screen.svg';

export const ControlButton: FC<ButtonHTMLAttributes<HTMLButtonElement>> = ({
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
  isColumnsExpanded,
  showFitView = true,
  showZoom = true,
  fitViewParams,
  className,
  deleted,
  isEditMode,
  hasEditAccess,
  onEditLinageClick,
  onExpandColumnClick,
  handleFullScreenViewClick,
  onExitFullScreenViewClick,
  loading,
  status,
  zoomValue,
  lineageData,
  lineageConfig,
  onOptionSelect,
  onLineageConfigUpdate,
}: ControlProps) => {
  const { t } = useTranslation();
  const { fitView, zoomTo } = useReactFlow();
  const [zoom, setZoom] = useState<number>(zoomValue);
  const [dialogVisible, setDialogVisible] = useState<boolean>(false);

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
  }, [onZoomHandler]);

  const onZoomOutHandler = useCallback(() => {
    setZoom((pre) => {
      const zoomOutValue = pre > MIN_ZOOM_VALUE ? pre - ZOOM_BUTTON_STEP : pre;
      onZoomHandler(zoomOutValue);

      return zoomOutValue;
    });
  }, [onZoomHandler]);

  const onFitViewHandler = useCallback(() => {
    fitView?.(fitViewParams);
  }, [fitView, fitViewParams]);

  const handleSearchFilterOption = (
    input: string,
    option?: {
      label: string;
      value: string;
    }
  ) => {
    return (option?.label || '').toLowerCase().includes(input.toLowerCase());
  };

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

  const nodeOptions = useMemo(
    () =>
      [lineageData.entity, ...(lineageData.nodes || [])].map((node) => ({
        label: getEntityName(node),
        value: node.id,
      })),
    [lineageData]
  );

  const editIcon = useMemo(() => {
    return (
      <SVGIcons
        alt="icon-edit-lineag"
        className="m--t-xss"
        icon={isEditMode ? 'icon-edit-lineage-color' : 'icon-edit-lineage'}
        width="14"
      />
    );
  }, [isEditMode]);

  const handleDialogSave = useCallback(
    (config: LineageConfig) => {
      onLineageConfigUpdate(config);
      setDialogVisible(false);
    },
    [onLineageConfigUpdate, setDialogVisible]
  );

  return (
    <>
      <Row
        className={classNames('z-10 w-full', className)}
        gutter={[8, 8]}
        style={style}>
        <Col span={12}>
          <Select
            allowClear
            showSearch
            className={classNames('custom-control-search-box', {
              'custom-control-search-box-edit-mode': isEditMode,
            })}
            filterOption={handleSearchFilterOption}
            options={nodeOptions}
            placeholder={t('label.search-entity', {
              entity: t('label.lineage'),
            })}
            onChange={onOptionSelect}
          />
        </Col>
        <Col span={12}>
          <Space className="justify-end w-full" size={16}>
            <Button
              ghost
              data-testid="expand-column"
              type="primary"
              onClick={onExpandColumnClick}>
              {isColumnsExpanded
                ? t('label.collapse-all')
                : t('label.expand-all')}
            </Button>

            {showZoom && (
              <div className="flow-control custom-control-fit-screen-button custom-control-zoom-slide">
                <ControlButton
                  className="custom-control-basic-button"
                  onClick={onZoomOutHandler}>
                  <SVGIcons
                    alt="minus-icon"
                    className="tw--mt-0.5"
                    icon="icon-control-minus"
                    width="12"
                  />
                </ControlButton>

                <input
                  className="tw-bg-body-hover"
                  max={MAX_ZOOM_VALUE}
                  min={MIN_ZOOM_VALUE}
                  step={ZOOM_SLIDER_STEP}
                  type="range"
                  value={zoom}
                  onChange={onRangeChange}
                />
                <ControlButton
                  className="custom-control-basic-button"
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
                className="custom-control-basic-button custom-control-fit-screen-button"
                title={t('label.fit-to-screen')}
                onClick={onFitViewHandler}>
                <SVGIcons alt="fit-view" icon={Icons.FITVEW} width="16" />
              </ControlButton>
            )}
            {handleFullScreenViewClick && (
              <ControlButton
                className="custom-control-basic-button custom-control-fit-screen-button"
                title={t('label.full-screen')}
                onClick={handleFullScreenViewClick}>
                <FullScreen color={PRIMERY_COLOR} height={16} width={16} />
              </ControlButton>
            )}
            {onExitFullScreenViewClick && (
              <ControlButton
                className="custom-control-basic-button custom-control-fit-screen-button"
                title={t('label.exit-fit-to-screen')}
                onClick={onExitFullScreenViewClick}>
                <ExitFullScreen color={PRIMERY_COLOR} height={16} width={16} />
              </ControlButton>
            )}

            <ControlButton
              className="custom-control-basic-button custom-control-fit-screen-button"
              disabled={isEditMode}
              title={t('label.setting-plural')}
              onClick={() => setDialogVisible(true)}>
              <SettingOutlined style={{ fontSize: '16px', color: '#7147E8' }} />
            </ControlButton>

            {!deleted && (
              <ControlButton
                className={classNames(
                  'custom-control-edit-button h-8 w-8 rounded-full p-x-xss tw-shadow-lg',
                  {
                    'bg-primary': !isEditMode,
                    'bg-primary-hover-lite': isEditMode,
                  }
                )}
                data-testid="edit-lineage"
                disabled={!hasEditAccess}
                title={
                  hasEditAccess
                    ? t('label.edit-entity', { entity: t('label.lineage') })
                    : NO_PERMISSION_FOR_ACTION
                }
                onClick={onEditLinageClick}>
                {getLoadingStatusValue(editIcon, loading, status)}
              </ControlButton>
            )}
          </Space>
        </Col>
      </Row>
      <LineageConfigModal
        config={lineageConfig}
        visible={dialogVisible}
        onCancel={() => setDialogVisible(false)}
        onSave={handleDialogSave}
      />
    </>
  );
};

export default memo(CustomControls);
