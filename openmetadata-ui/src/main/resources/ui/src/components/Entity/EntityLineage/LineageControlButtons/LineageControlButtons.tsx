/*
 *  Copyright 2025 Collate.
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
  ArrowsAltOutlined,
  ExpandOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  NodeIndexOutlined,
  SettingOutlined,
  ShrinkOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import classNames from 'classnames';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as ExportIcon } from '../../../../assets/svg/ic-export.svg';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { SERVICE_TYPES } from '../../../../constants/Services.constant';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { LineageLayer } from '../../../../generated/configuration/lineageSettings';
import { getLoadingStatusValue } from '../../../../utils/EntityLineageUtils';
import { AssetsUnion } from '../../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { LineageConfig } from '../EntityLineage.interface';
import LineageConfigModal from '../LineageConfigModal';
import './lineage-control-buttons.less';
import { LineageControlButtonsProps } from './LineageControlButtons.interface';

const LineageControlButtons: FC<LineageControlButtonsProps> = ({
  handleFullScreenViewClick,
  onExitFullScreenViewClick,
  deleted,
  hasEditAccess,
  entityType,
}) => {
  const { t } = useTranslation();
  const [dialogVisible, setDialogVisible] = useState<boolean>(false);
  const {
    activeLayer,
    isEditMode,
    expandAllColumns,
    lineageConfig,
    platformView,
    toggleColumnView,
    onExportClick,
    loading,
    status,
    onLineageEditClick,
    onLineageConfigUpdate,
    reactFlowInstance,
    redraw,
  } = useLineageProvider();

  const isColumnLayerActive = useMemo(() => {
    return activeLayer.includes(LineageLayer.ColumnLevelLineage);
  }, [activeLayer]);

  const editIcon = (
    <span className="anticon">
      <EditIcon className={isEditMode ? 'active' : ''} height={18} width={18} />
    </span>
  );

  const handleDialogSave = useCallback(
    (config: LineageConfig) => {
      onLineageConfigUpdate?.(config);
      setDialogVisible(false);
    },
    [onLineageConfigUpdate, setDialogVisible]
  );

  const handleZoomIn = useCallback(() => {
    reactFlowInstance?.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance?.zoomOut();
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  const handleRearrange = useCallback(() => {
    redraw?.();
  }, [redraw]);

  return (
    <>
      <div className="lineage-control-buttons">
        {!deleted &&
          platformView === LineagePlatformView.None &&
          entityType &&
          !SERVICE_TYPES.includes(entityType as AssetsUnion) && (
            <Button
              className={classNames('lineage-button', {
                active: isEditMode,
              })}
              data-testid="edit-lineage"
              disabled={!hasEditAccess}
              icon={getLoadingStatusValue(editIcon, loading, status)}
              title={
                hasEditAccess
                  ? t('label.edit-entity', { entity: t('label.lineage') })
                  : NO_PERMISSION_FOR_ACTION
              }
              type="text"
              onClick={onLineageEditClick}
            />
          )}

        {isColumnLayerActive && !isEditMode && (
          <Button
            className="lineage-button"
            data-testid="expand-column"
            icon={expandAllColumns ? <ShrinkOutlined /> : <ArrowsAltOutlined />}
            title={
              expandAllColumns ? t('label.collapse-all') : t('label.expand-all')
            }
            type="text"
            onClick={toggleColumnView}
          />
        )}

        <Button
          className="lineage-button"
          data-testid="lineage-export"
          disabled={isEditMode}
          icon={
            <span className="anticon">
              <ExportIcon height={18} width={18} />
            </span>
          }
          title={t('label.export-entity', { entity: t('label.lineage') })}
          type="text"
          onClick={onExportClick}
        />

        {handleFullScreenViewClick && (
          <Button
            className="lineage-button"
            data-testid="full-screen"
            icon={
              <span className="anticon">
                <FullscreenOutlined />
              </span>
            }
            title={t('label.full-screen')}
            type="text"
            onClick={handleFullScreenViewClick}
          />
        )}
        {onExitFullScreenViewClick && (
          <Button
            className="lineage-button"
            data-testid="exit-full-screen"
            icon={
              <span className="anticon">
                <FullscreenExitOutlined />
              </span>
            }
            title={t('label.exit-full-screen')}
            type="text"
            onClick={onExitFullScreenViewClick}
          />
        )}

        <Button
          className="lineage-button"
          data-testid="zoom-in"
          icon={<ZoomInOutlined />}
          title={t('label.zoom-in')}
          type="text"
          onClick={handleZoomIn}
        />

        <Button
          className="lineage-button"
          data-testid="zoom-out"
          icon={<ZoomOutOutlined />}
          title={t('label.zoom-out')}
          type="text"
          onClick={handleZoomOut}
        />

        <Button
          className="lineage-button"
          data-testid="fit-screen"
          icon={<ExpandOutlined />}
          title={t('label.fit-to-screen')}
          type="text"
          onClick={handleFitView}
        />

        <Button
          className="lineage-button"
          data-testid="rearrange"
          icon={<NodeIndexOutlined />}
          title={t('label.rearrange-nodes')}
          type="text"
          onClick={handleRearrange}
        />

        <Button
          className="lineage-button"
          data-testid="lineage-config"
          disabled={isEditMode}
          icon={<SettingOutlined />}
          title={t('label.setting-plural')}
          type="text"
          onClick={() => setDialogVisible(true)}
        />
      </div>

      <LineageConfigModal
        config={lineageConfig}
        visible={dialogVisible}
        onCancel={() => setDialogVisible(false)}
        onSave={handleDialogSave}
      />
    </>
  );
};

export default LineageControlButtons;
