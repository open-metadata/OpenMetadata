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
  FullscreenExitOutlined,
  FullscreenOutlined,
  ShrinkOutlined,
} from '@ant-design/icons';
import {
  Button,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import Qs from 'qs';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as FitScreenIcon } from '../../../../assets/svg/ic-fit-screen.svg';
import { ReactComponent as FitViewOptionsIcon } from '../../../../assets/svg/ic-fit-view-options.svg';
import { ReactComponent as HomeIcon } from '../../../../assets/svg/ic-home.svg';
import { ReactComponent as MapIcon } from '../../../../assets/svg/ic-map.svg';
import { ReactComponent as RearrangeNodesIcon } from '../../../../assets/svg/ic-rearrange-nodes.svg';
import { ReactComponent as ZoomInIcon } from '../../../../assets/svg/ic-zoom-in.svg';
import { ReactComponent as ZoomOutIcon } from '../../../../assets/svg/ic-zoom-out.svg';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../../../constants/constants';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineageLayer } from '../../../../generated/configuration/lineageSettings';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { StyledMenu } from '../../../LineageTable/LineageTable.styled';

const LineageControlButtons: FC<{
  onToggleMiniMap: () => void;
  miniMapVisible?: boolean;
}> = ({ onToggleMiniMap, miniMapVisible = false }) => {
  const { t } = useTranslation();
  const [lineageViewOptionsAnchorEl, setLineageViewOptionsAnchorEl] =
    useState<null | HTMLElement>(null);

  const {
    reactFlowInstance,
    redraw,
    activeLayer,
    isEditMode,
    expandAllColumns,
    toggleColumnView,
  } = useLineageProvider();
  const navigate = useNavigate();
  const location = useCustomLocation();

  const isColumnLayerActive = useMemo(() => {
    return activeLayer.includes(LineageLayer.ColumnLevelLineage);
  }, [activeLayer]);

  const isFullscreen = useMemo(() => {
    const params = Qs.parse(location.search, { ignoreQueryPrefix: true });

    return params[FULLSCREEN_QUERY_PARAM_KEY] === 'true';
  }, [location.search]);

  const toggleFullscreenView = useCallback(() => {
    navigate({
      search: isFullscreen
        ? ''
        : Qs.stringify({ [FULLSCREEN_QUERY_PARAM_KEY]: !isFullscreen }),
    });
  }, [isFullscreen]);

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

  const handleRefocusSelected = useCallback(() => {
    const selectedElements = reactFlowInstance
      ?.getNodes()
      .filter((el) => el.selected);
    if (selectedElements && selectedElements.length > 0) {
      reactFlowInstance?.fitView({
        padding: 0.2,
        nodes: selectedElements,
      });
    }
  }, [reactFlowInstance]);

  const handleRefocusHome = useCallback(() => {
    reactFlowInstance?.setCenter(0, 0, { zoom: 1 });
  }, [reactFlowInstance]);

  return (
    <>
      <ToggleButtonGroup
        exclusive
        sx={{
          /* Shadows/shadow-xs */
          boxShadow: '0 1px 2px 0 rgba(10, 13, 18, 0.05)',
          background: '#fff',

          svg: {
            height: 16,
            width: 16,
          },
        }}>
        <ToggleButton
          data-testid="fit-screen"
          title={t('label.fit-to-screen')}
          value="fit-view"
          onClick={(event) =>
            setLineageViewOptionsAnchorEl(event.currentTarget)
          }>
          <FitViewOptionsIcon />
        </ToggleButton>

        <StyledMenu
          anchorEl={lineageViewOptionsAnchorEl}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          id="lineage-view-options-menu"
          open={Boolean(lineageViewOptionsAnchorEl)}
          slotProps={{
            paper: {
              sx: {
                marginTop: '0',
              },
            },
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          onClose={() => setLineageViewOptionsAnchorEl(null)}>
          <MenuItem onClick={handleFitView}>
            <FitScreenIcon />
            {t('label.fit-to-screen')}
          </MenuItem>
          <MenuItem onClick={handleRefocusSelected}>
            <FitViewOptionsIcon />
            {t('label.refocused-to-selected')}
          </MenuItem>
          <MenuItem onClick={handleRearrange}>
            <RearrangeNodesIcon />
            {t('label.rearrange-nodes')}
          </MenuItem>
          <MenuItem onClick={handleRefocusHome}>
            <HomeIcon />
            {t('label.refocused-to-home')}
          </MenuItem>
        </StyledMenu>

        {isColumnLayerActive && !isEditMode && (
          <Button
            className="lineage-button"
            data-testid="expand-column"
            title={
              expandAllColumns ? t('label.collapse-all') : t('label.expand-all')
            }
            onClick={toggleColumnView}>
            {expandAllColumns ? <ShrinkOutlined /> : <ArrowsAltOutlined />}
          </Button>
        )}

        <ToggleButton
          data-testid="toggle-mini-map"
          selected={miniMapVisible}
          title={t('label.mini-map')}
          value="mini-map"
          onClick={onToggleMiniMap}>
          <MapIcon />
        </ToggleButton>

        <ToggleButton
          data-testid="zoom-in"
          title={t('label.zoom-in')}
          value="zoom-in"
          onClick={handleZoomIn}>
          <ZoomInIcon />
        </ToggleButton>

        <ToggleButton
          data-testid="zoom-out"
          title={t('label.zoom-out')}
          value="zoom-out"
          onClick={handleZoomOut}>
          <ZoomOutIcon />
        </ToggleButton>

        <ToggleButton
          data-testid={isFullscreen ? 'exit-full-screen' : 'full-screen'}
          title={t('label.full-screen')}
          value="full-screen"
          onClick={toggleFullscreenView}>
          {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </ToggleButton>
      </ToggleButtonGroup>
    </>
  );
};

export default LineageControlButtons;
