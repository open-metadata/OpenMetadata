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
  ButtonUtility,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Maximize02,
  Minus,
  Plus,
  RefreshCw01,
} from '@openmetadata/ui-core-components/icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { KnowledgeGraphViewControlsProps } from './KnowledgeGraph.interface';

/** The ButtonUtility `icon` prop accepts a component; align the SVG asset to that shape. */
type IconComponent = FC<{ className?: string }>;

/**
 * The floating viewport controls in the corner of the canvas — zoom, fit and
 * refresh. Mirrors the Lineage canvas controls (#34551) so the two canvas
 * surfaces read as the same control: a `Card variant="elevated"` with
 * `ButtonUtility` kids and the current zoom level shown as a
 * `Typography` between the `−` / `+` pair.
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
    <Card
      className="tw:absolute tw:right-4 tw:bottom-4"
      data-testid="graph-view-controls"
      size="sm"
      variant="elevated">
      <Card.Content>
        <Box align="center" gap={4}>
          <ButtonUtility
            aria-label={t('label.zoom-out')}
            data-testid="zoom-out"
            icon={Minus as IconComponent}
            size="lg"
            tooltip={t('label.zoom-out')}
            onPress={onZoomOut}
          />
          <Typography
            as="span"
            className="tw:min-w-10 tw:text-center tw:tabular-nums tw:text-secondary"
            data-testid="zoom-level"
            size="text-sm"
            weight="semibold">
            {Math.round(zoom * 100) + '%'}
          </Typography>
          <ButtonUtility
            aria-label={t('label.zoom-in')}
            data-testid="zoom-in"
            icon={Plus as IconComponent}
            size="lg"
            tooltip={t('label.zoom-in')}
            onPress={onZoomIn}
          />
          <ButtonUtility
            aria-label={t('label.fit-to-screen')}
            data-testid="fit-screen"
            icon={Maximize02 as IconComponent}
            size="lg"
            tooltip={t('label.fit-to-screen')}
            onPress={onFit}
          />
          <ButtonUtility
            aria-label={t('label.refresh')}
            data-testid="refresh"
            icon={RefreshCw01 as IconComponent}
            size="lg"
            tooltip={t('label.refresh')}
            onPress={onRefresh}
          />
        </Box>
      </Card.Content>
    </Card>
  );
};

export default KnowledgeGraphViewControls;
