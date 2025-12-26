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
import { ArrowsAltOutlined, ShrinkOutlined } from '@ant-design/icons';
import {
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useTheme,
} from '@mui/material';
import Qs from 'qs';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as ExitFullScreenIcon } from '../../../../assets/svg/ic-exit-fullscreen.svg';
import { ReactComponent as FitScreenIcon } from '../../../../assets/svg/ic-fit-screen.svg';
import { ReactComponent as FitViewOptionsIcon } from '../../../../assets/svg/ic-fit-view-options.svg';
import { ReactComponent as FullscreenIcon } from '../../../../assets/svg/ic-fullscreen.svg';
import { ReactComponent as HomeIcon } from '../../../../assets/svg/ic-home.svg';
import { ReactComponent as MapIcon } from '../../../../assets/svg/ic-map.svg';
import { ReactComponent as RearrangeNodesIcon } from '../../../../assets/svg/ic-rearrange-nodes.svg';
import { ReactComponent as ZoomInIcon } from '../../../../assets/svg/ic-zoom-in.svg';
import { ReactComponent as ZoomOutIcon } from '../../../../assets/svg/ic-zoom-out.svg';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../../../constants/constants';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineageLayer } from '../../../../generated/configuration/lineageSettings';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { centerNodePosition } from '../../../../utils/EntityLineageUtils';
import { StyledMenu } from '../../../LineageTable/LineageTable.styled';

const LineageControlButtons: FC<{
  onToggleMiniMap: () => void;
  miniMapVisible?: boolean;
}> = ({ onToggleMiniMap, miniMapVisible = false }) => {
  const { t } = useTranslation();
  const theme = useTheme();
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
    const currentZoom = reactFlowInstance?.getZoom() ?? 1;
    reactFlowInstance?.fitView({ padding: 0.2 });
    reactFlowInstance?.zoomTo(currentZoom);

    setLineageViewOptionsAnchorEl(null);
  }, [reactFlowInstance]);

  const handleRearrange = useCallback(() => {
    redraw?.();
    setLineageViewOptionsAnchorEl(null);
  }, [redraw]);

  const handleRefocusSelected = useCallback(() => {
    const selectedElement = reactFlowInstance
      ?.getNodes()
      .find((el) => el.selected);

    selectedElement && centerNodePosition(selectedElement, reactFlowInstance);
    setLineageViewOptionsAnchorEl(null);
  }, [reactFlowInstance]);

  const handleRefocusHome = useCallback(() => {
    const selectedElement = reactFlowInstance
      ?.getNodes()
      .find((el) => el.data.isRootNode);
    selectedElement && centerNodePosition(selectedElement, reactFlowInstance);
    setLineageViewOptionsAnchorEl(null);
  }, [reactFlowInstance]);

  return (
    <ToggleButtonGroup
      exclusive
      color="primary"
      sx={{
        /* Shadows/shadow-xs */
        boxShadow: theme.shadows[1],
        background: theme.palette.background.paper,

        svg: {
          height: theme.spacing(4),
          width: theme.spacing(4),
        },
      }}>
      <Tooltip
        arrow
        placement="top"
        title={t('label.lineage-view-option-plural')}>
        <ToggleButton
          data-testid="fit-screen"
          value="fit-view"
          onClick={(event) =>
            setLineageViewOptionsAnchorEl(event.currentTarget)
          }>
          <FitViewOptionsIcon />
        </ToggleButton>
      </Tooltip>

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

      {/* Remove this after we have paginated column view inside nodes */}
      {isColumnLayerActive && !isEditMode && (
        <Tooltip
          arrow
          placement="top"
          title={
            expandAllColumns ? t('label.collapse-all') : t('label.expand-all')
          }>
          <ToggleButton
            className="lineage-button"
            data-testid="expand-column"
            value="expand-column"
            onClick={toggleColumnView}>
            {expandAllColumns ? <ShrinkOutlined /> : <ArrowsAltOutlined />}
          </ToggleButton>
        </Tooltip>
      )}

      <Tooltip arrow placement="top" title={t('label.mind-map')}>
        <ToggleButton
          data-testid="toggle-mind-map"
          selected={miniMapVisible}
          value="mind-map"
          onClick={onToggleMiniMap}>
          <MapIcon />
        </ToggleButton>
      </Tooltip>

      <Tooltip arrow placement="top" title={t('label.zoom-in')}>
        <ToggleButton
          data-testid="zoom-in"
          value="zoom-in"
          onClick={handleZoomIn}>
          <ZoomInIcon />
        </ToggleButton>
      </Tooltip>

      <Tooltip arrow placement="top" title={t('label.zoom-out')}>
        <ToggleButton
          data-testid="zoom-out"
          value="zoom-out"
          onClick={handleZoomOut}>
          <ZoomOutIcon />
        </ToggleButton>
      </Tooltip>

      <Tooltip
        arrow
        placement="top"
        title={
          isFullscreen
            ? t('label.exit-full-screen')
            : t('label.full-screen-view')
        }>
        <ToggleButton
          data-testid={isFullscreen ? 'exit-full-screen' : 'full-screen'}
          selected={isFullscreen}
          size="large"
          value="full-screen"
          onClick={toggleFullscreenView}>
          {isFullscreen ? <ExitFullScreenIcon /> : <FullscreenIcon />}
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
};

export default LineageControlButtons;
