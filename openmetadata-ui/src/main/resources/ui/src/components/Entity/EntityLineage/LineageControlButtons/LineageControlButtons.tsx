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
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Dropdown,
  Tooltip,
} from '@openmetadata/ui-core-components';
import Qs from 'qs';
import { FC, useCallback, useMemo } from 'react';
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
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { centerNodePosition } from '../../../../utils/EntityLineageUtils';

const LineageControlButtons: FC<{
  onToggleMiniMap: () => void;
  miniMapVisible?: boolean;
}> = ({ onToggleMiniMap, miniMapVisible = false }) => {
  const { t } = useTranslation();
  const { reactFlowInstance, redraw } = useLineageProvider();
  const navigate = useNavigate();
  const location = useCustomLocation();

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
  }, [reactFlowInstance]);

  const handleRearrange = useCallback(() => {
    redraw?.();
  }, [redraw]);

  const handleRefocusSelected = useCallback(() => {
    const selectedElement = reactFlowInstance
      ?.getNodes()
      .find((el) => el.selected);
    selectedElement && centerNodePosition(selectedElement, reactFlowInstance);
  }, [reactFlowInstance]);

  const handleRefocusHome = useCallback(() => {
    const selectedElement = reactFlowInstance
      ?.getNodes()
      .find((el) => el.data.isRootNode);
    selectedElement && centerNodePosition(selectedElement, reactFlowInstance);
  }, [reactFlowInstance]);

  return (
    <div className="tw:flex tw:items-center">
      <Dropdown.Root>
        <Button
          color="secondary"
          data-testid="fit-screen"
          iconLeading={FitViewOptionsIcon}
          size="sm"
        />
        <Dropdown.Popover>
          <Dropdown.Menu>
            <Dropdown.Item
              icon={FitScreenIcon}
              id="fit-view"
              label={t('label.fit-to-screen')}
              onAction={handleFitView}
            />
            <Dropdown.Item
              icon={FitViewOptionsIcon}
              id="refocus-selected"
              label={t('label.refocused-to-selected')}
              onAction={handleRefocusSelected}
            />
            <Dropdown.Item
              icon={RearrangeNodesIcon}
              id="rearrange"
              label={t('label.rearrange-nodes')}
              onAction={handleRearrange}
            />
            <Dropdown.Item
              icon={HomeIcon}
              id="refocus-home"
              label={t('label.refocused-to-home')}
              onAction={handleRefocusHome}
            />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>

      <ButtonGroup onSelectionChange={() => {}}>
        <Tooltip placement="top" title={t('label.mind-map')}>
          <ButtonGroupItem
            className={
              miniMapVisible ? 'tw:bg-brand-100! tw:*:text-brand-700!' : ''
            }
            data-testid="toggle-mind-map"
            iconLeading={MapIcon}
            id="mind-map"
            isSelected={miniMapVisible}
            onPress={onToggleMiniMap}
          />
        </Tooltip>

        <Tooltip placement="top" title={t('label.zoom-in')}>
          <ButtonGroupItem
            data-testid="zoom-in"
            iconLeading={ZoomInIcon}
            id="zoom-in"
            onPress={handleZoomIn}
          />
        </Tooltip>

        <Tooltip placement="top" title={t('label.zoom-out')}>
          <ButtonGroupItem
            data-testid="zoom-out"
            iconLeading={ZoomOutIcon}
            id="zoom-out"
            onPress={handleZoomOut}
          />
        </Tooltip>

        <Tooltip
          placement="top"
          title={
            isFullscreen
              ? t('label.exit-full-screen')
              : t('label.full-screen-view')
          }>
          <ButtonGroupItem
            className={
              isFullscreen ? 'tw:bg-brand-100! tw:*:text-brand-700!' : ''
            }
            data-testid={isFullscreen ? 'exit-full-screen' : 'full-screen'}
            iconLeading={isFullscreen ? ExitFullScreenIcon : FullscreenIcon}
            id="full-screen"
            isSelected={isFullscreen}
            onPress={toggleFullscreenView}
          />
        </Tooltip>
      </ButtonGroup>
    </div>
  );
};

export default LineageControlButtons;
