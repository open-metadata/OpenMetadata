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
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { Minus, Plus } from '@openmetadata/ui-core-components/icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FitScreenIcon } from '../../../assets/svg/ic-fit-screen.svg';
import { ReactComponent as RefreshIcon } from '../../../assets/svg/reload.svg';
import { KnowledgeGraphViewControlsProps } from './KnowledgeGraph.interface';

/** The Button `iconLeading` prop accepts a component; align the SVG asset to that shape. */
type IconComponent = FC<{ className?: string }>;

/**
 * The floating viewport controls in the corner of the canvas — zoom, fit and
 * refresh. Mirrors the Lineage canvas controls (#34551) so the two canvas
 * surfaces read as the same control: a `Card variant="elevated"` with
 * `Button color="link-gray"` kids and the current zoom level shown as a
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
          <Button
            aria-label={t('label.zoom-out')}
            color="link-gray"
            data-testid="zoom-out"
            iconLeading={Minus as IconComponent}
            size="sm"
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
          <Button
            aria-label={t('label.zoom-in')}
            color="link-gray"
            data-testid="zoom-in"
            iconLeading={Plus as IconComponent}
            size="sm"
            tooltip={t('label.zoom-in')}
            onPress={onZoomIn}
          />
          <Button
            aria-label={t('label.fit-to-screen')}
            color="link-gray"
            data-testid="fit-screen"
            iconLeading={FitScreenIcon as IconComponent}
            size="sm"
            tooltip={t('label.fit-to-screen')}
            onPress={onFit}
          />
          <Button
            aria-label={t('label.refresh')}
            color="link-gray"
            data-testid="refresh"
            iconLeading={RefreshIcon as IconComponent}
            size="sm"
            tooltip={t('label.refresh')}
            onPress={onRefresh}
          />
        </Box>
      </Card.Content>
    </Card>
  );
};

export default KnowledgeGraphViewControls;
