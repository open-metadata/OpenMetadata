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
  ButtonGroup,
  ButtonGroupItem,
  Dropdown,
  Tooltip,
} from '@openmetadata/ui-core-components';
import Qs from 'qs';
import { FC, useCallback, useMemo } from 'react';
import type { Key } from 'react-aria-components';
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
import { centerNodePosition } from '../../../../utils/EntityLineageLayoutUtils';

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

  const handleMenuAction = useCallback(
    (key: Key) => {
      switch (key) {
        case 'fit':
          handleFitView();

          break;
        case 'refocus-selected':
          handleRefocusSelected();

          break;
        case 'rearrange':
          handleRearrange();

          break;
        case 'refocus-home':
          handleRefocusHome();

          break;
      }
    },
    [handleFitView, handleRefocusSelected, handleRearrange, handleRefocusHome]
  );

  return (
    <ButtonGroup
      aria-label={t('label.lineage-controls')}
      selectedKeys={
        new Set([
          ...(miniMapVisible ? ['mind-map'] : []),
          ...(isFullscreen ? ['full-screen'] : []),
        ])
      }
      selectionMode="multiple"
      size="sm"
      onSelectionChange={() => void 0}>
      <Dropdown.Root>
        <Tooltip placement="top" title={t('label.lineage-view-option-plural')}>
          <ButtonGroupItem
            aria-label={t('label.lineage-view-option-plural')}
            data-testid="fit-screen"
            iconLeading={FitViewOptionsIcon as FC<{ className?: string }>}
            id="fit-view"
          />
        </Tooltip>
        <Dropdown.Popover>
          <Dropdown.Menu
            aria-label={t('label.lineage-view-option-plural')}
            onAction={handleMenuAction}>
            <Dropdown.Item
              icon={FitScreenIcon as FC<{ className?: string }>}
              id="fit"
              label={t('label.fit-to-screen')}
            />
            <Dropdown.Item
              icon={FitViewOptionsIcon as FC<{ className?: string }>}
              id="refocus-selected"
              label={t('label.refocused-to-selected')}
            />
            <Dropdown.Item
              icon={RearrangeNodesIcon as FC<{ className?: string }>}
              id="rearrange"
              label={t('label.rearrange-nodes')}
            />
            <Dropdown.Item
              icon={HomeIcon as FC<{ className?: string }>}
              id="refocus-home"
              label={t('label.refocused-to-home')}
            />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>

      <Tooltip placement="top" title={t('label.mind-map')}>
        <ButtonGroupItem
          aria-label={t('label.mind-map')}
          data-testid="toggle-mind-map"
          iconLeading={MapIcon as FC<{ className?: string }>}
          id="mind-map"
          onPress={onToggleMiniMap}
        />
      </Tooltip>

      <Tooltip placement="top" title={t('label.zoom-in')}>
        <ButtonGroupItem
          aria-label={t('label.zoom-in')}
          data-testid="zoom-in"
          iconLeading={ZoomInIcon as FC<{ className?: string }>}
          id="zoom-in"
          onPress={handleZoomIn}
        />
      </Tooltip>

      <Tooltip placement="top" title={t('label.zoom-out')}>
        <ButtonGroupItem
          aria-label={t('label.zoom-out')}
          data-testid="zoom-out"
          iconLeading={ZoomOutIcon as FC<{ className?: string }>}
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
          aria-label={
            isFullscreen
              ? t('label.exit-full-screen')
              : t('label.full-screen-view')
          }
          data-testid={isFullscreen ? 'exit-full-screen' : 'full-screen'}
          iconLeading={
            (isFullscreen ? ExitFullScreenIcon : FullscreenIcon) as FC<{
              className?: string;
            }>
          }
          id="full-screen"
          onPress={toggleFullscreenView}
        />
      </Tooltip>
    </ButtonGroup>
  );
};

export default LineageControlButtons;
