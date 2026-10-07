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
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactFlowInstance, useViewport } from 'reactflow';
import { ReactComponent as FitScreenIcon } from '../../../../assets/svg/ic-fit-screen.svg';
import { ReactComponent as MapIcon } from '../../../../assets/svg/ic-map.svg';
import { ReactComponent as ZoomInIcon } from '../../../../assets/svg/ic-zoom-in.svg';
import { ReactComponent as ZoomOutIcon } from '../../../../assets/svg/ic-zoom-out.svg';
import { useLineageStore } from '../../../../hooks/useLineageStore';

type IconComponent = FC<{ className?: string }>;

const LineageControlButtons: FC<{
  onToggleMiniMap: () => void;
  miniMapVisible?: boolean;
  reactFlowInstance?: ReactFlowInstance;
  onFitView?: () => void;
}> = ({
  onToggleMiniMap,
  miniMapVisible = false,
  reactFlowInstance: controlledReactFlowInstance,
  onFitView,
}) => {
  const { t } = useTranslation();
  const providerReactFlowInstance = useLineageStore((s) => s.reactFlowInstance);
  const reactFlowInstance =
    controlledReactFlowInstance ?? providerReactFlowInstance;
  const { zoom } = useViewport();
  const handleZoomIn = useCallback(() => {
    reactFlowInstance?.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance?.zoomOut();
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    if (onFitView) {
      onFitView();

      return;
    }
    reactFlowInstance?.fitView({ padding: 0.2, maxZoom: 1 });
  }, [onFitView, reactFlowInstance]);

  return (
    <Card size="sm" variant="elevated">
      <Card.Content>
        <Box align="center" gap={4}>
          <Button
            aria-label={t('label.mind-map')}
            aria-pressed={miniMapVisible}
            color={miniMapVisible ? 'link-color' : 'link-gray'}
            data-testid="toggle-mind-map"
            iconLeading={MapIcon as IconComponent}
            size="sm"
            tooltip={t('label.mind-map')}
            onClick={onToggleMiniMap}
          />
          <Button
            aria-label={t('label.zoom-in')}
            color="link-gray"
            data-testid="zoom-in"
            iconLeading={ZoomInIcon as IconComponent}
            size="sm"
            tooltip={t('label.zoom-in')}
            onClick={handleZoomIn}
          />
          <Typography
            as="span"
            className="tw:min-w-10 tw:text-center tw:tabular-nums tw:text-secondary"
            data-testid="zoom-level"
            size="text-sm">
            {`${Math.round(zoom * 100)}%`}
          </Typography>
          <Button
            aria-label={t('label.zoom-out')}
            color="link-gray"
            data-testid="zoom-out"
            iconLeading={ZoomOutIcon as IconComponent}
            size="sm"
            tooltip={t('label.zoom-out')}
            onClick={handleZoomOut}
          />
          <Button
            aria-label={t('label.fit-to-screen')}
            color="link-gray"
            data-testid="fit-screen"
            iconLeading={FitScreenIcon as IconComponent}
            size="sm"
            tooltip={t('label.fit-to-screen')}
            onClick={handleFitView}
          />
        </Box>
      </Card.Content>
    </Card>
  );
};

export default LineageControlButtons;
