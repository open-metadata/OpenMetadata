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

import {
  Box,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Minus, Plus } from '@untitledui/icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FitScreenIcon } from '../../assets/svg/ic-fit-screen.svg';
import { ReactComponent as RefreshIcon } from '../../assets/svg/reload.svg';
import { KnowledgeGraphViewControlsProps } from './KnowledgeGraph.interface';

/**
 * The floating viewport controls in the corner of the canvas — zoom, fit,
 * fullscreen and refresh. Separate from the toolbar above the graph, which
 * changes *what* is shown rather than how it is framed.
 */
const KnowledgeGraphViewControls: FC<KnowledgeGraphViewControlsProps> = ({
  zoom = 1,
  onFit,
  onRefresh,
  onZoomIn,
  onZoomOut,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="knowledge-graph-action-buttons"
      data-testid="graph-view-controls">
      <Tooltip title={t('label.zoom-out')}>
        <TooltipTrigger
          aria-label={t('label.zoom-out')}
          className="kg-control-btn"
          data-testid="zoom-out"
          onPress={onZoomOut}>
          <Minus aria-hidden="true" />
        </TooltipTrigger>
      </Tooltip>
      <Box
        align="center"
        className="tw:min-w-11 tw:px-1 tw:text-tertiary"
        justify="center">
        <Typography size="text-xs" weight="semibold">
          {Math.round(zoom * 100)}%
        </Typography>
      </Box>
      <Tooltip title={t('label.zoom-in')}>
        <TooltipTrigger
          aria-label={t('label.zoom-in')}
          className="kg-control-btn"
          data-testid="zoom-in"
          onPress={onZoomIn}>
          <Plus aria-hidden="true" />
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
