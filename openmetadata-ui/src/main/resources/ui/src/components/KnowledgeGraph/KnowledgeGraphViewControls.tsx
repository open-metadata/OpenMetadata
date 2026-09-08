/*
 *  Copyright 2026 Collate.
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

import { Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExitFullScreenIcon } from '../../assets/svg/ic-exit-fullscreen.svg';
import { ReactComponent as FitScreenIcon } from '../../assets/svg/ic-fit-screen.svg';
import { ReactComponent as FullscreenIcon } from '../../assets/svg/ic-fullscreen.svg';
import { ReactComponent as ZoomInIcon } from '../../assets/svg/ic-zoom-in.svg';
import { ReactComponent as ZoomOutIcon } from '../../assets/svg/ic-zoom-out.svg';
import { ReactComponent as RefreshIcon } from '../../assets/svg/reload.svg';
import { KnowledgeGraphViewControlsProps } from './KnowledgeGraph.interface';

/**
 * The floating viewport controls in the corner of the canvas — zoom, fit,
 * fullscreen and refresh. Separate from the toolbar above the graph, which
 * changes *what* is shown rather than how it is framed.
 */
const KnowledgeGraphViewControls: FC<KnowledgeGraphViewControlsProps> = ({
  isFullscreen,
  onFit,
  onFullscreen,
  onRefresh,
  onZoomIn,
  onZoomOut,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="knowledge-graph-action-buttons"
      data-testid="graph-view-controls">
      <Tooltip title={t('label.zoom-in')}>
        <TooltipTrigger
          aria-label={t('label.zoom-in')}
          className="kg-control-btn"
          data-testid="zoom-in"
          onPress={onZoomIn}>
          <ZoomInIcon aria-hidden="true" />
        </TooltipTrigger>
      </Tooltip>
      <Tooltip title={t('label.zoom-out')}>
        <TooltipTrigger
          aria-label={t('label.zoom-out')}
          className="kg-control-btn"
          data-testid="zoom-out"
          onPress={onZoomOut}>
          <ZoomOutIcon aria-hidden="true" />
        </TooltipTrigger>
      </Tooltip>
      <Tooltip title={t('label.fit-to-screen')}>
        <TooltipTrigger
          aria-label={t('label.fit-to-screen')}
          className="kg-control-btn"
          data-testid="fit-screen"
          onPress={onFit}>
          <FitScreenIcon aria-hidden="true" />
        </TooltipTrigger>
      </Tooltip>
      <Tooltip
        title={
          isFullscreen
            ? t('label.exit-full-screen')
            : t('label.full-screen-view')
        }>
        <TooltipTrigger
          aria-label={
            isFullscreen
              ? t('label.exit-full-screen')
              : t('label.full-screen-view')
          }
          className="kg-control-btn"
          data-testid={isFullscreen ? 'exit-full-screen' : 'full-screen'}
          onPress={onFullscreen}>
          {isFullscreen ? (
            <ExitFullScreenIcon aria-hidden="true" />
          ) : (
            <FullscreenIcon aria-hidden="true" />
          )}
        </TooltipTrigger>
      </Tooltip>
      <Tooltip title={t('label.refresh')}>
        <TooltipTrigger
          aria-label={t('label.refresh')}
          className="kg-control-btn"
          data-testid="refresh"
          onPress={onRefresh}>
          <RefreshIcon aria-hidden="true" />
        </TooltipTrigger>
      </Tooltip>
    </div>
  );
};

export default KnowledgeGraphViewControls;
