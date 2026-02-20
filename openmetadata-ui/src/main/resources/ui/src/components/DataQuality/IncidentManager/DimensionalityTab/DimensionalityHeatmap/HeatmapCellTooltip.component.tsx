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

import { Box, Card, Divider, Stack, Typography } from '@mui/material';
import { isUndefined } from 'lodash';
import { FC, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../../../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../../../common/StatusBadge/StatusBadge.interface';
import { TOOLTIP_STYLES } from './DimensionalityHeatmap.constants';
import { HeatmapCellData } from './DimensionalityHeatmap.interface';
import { getStatusLabel } from './DimensionalityHeatmap.utils';

interface TooltipRowProps {
  label: string;
  value: ReactNode;
}

const TooltipRow: FC<TooltipRowProps> = ({ label, value }) => {
  return (
    <Box className="d-flex items-center justify-between " gap={20}>
      <Typography
        sx={(theme) => ({
          color: theme.palette.allShades.gray[700],
          fontSize: theme.typography.pxToRem(TOOLTIP_STYLES.CONTENT_FONT_SIZE),
          whiteSpace: 'nowrap',
        })}>
        {label}
      </Typography>
      <Typography
        sx={(theme) => ({
          color: theme.palette.allShades.gray[900],
          fontWeight: theme.typography.fontWeightMedium,
          fontSize: theme.typography.pxToRem(TOOLTIP_STYLES.CONTENT_FONT_SIZE),
        })}>
        {value}
      </Typography>
    </Box>
  );
};

interface HeatmapCellTooltipProps {
  cell: HeatmapCellData;
}

export const HeatmapCellTooltip: FC<HeatmapCellTooltipProps> = ({ cell }) => {
  const { t } = useTranslation();

  const rows = useMemo(
    () => [
      {
        key: 'dimensionValue',
        label: t('label.dimension-value'),
        value: cell.dimensionValue,
      },
      {
        key: 'status',
        label: t('label.status'),
        value: (
          <StatusBadge
            dataTestId="status-badge"
            label={getStatusLabel(cell.status, t)}
            status={cell.status as StatusType}
          />
        ),
      },
      {
        key: 'passedRows',
        label: t('label.passed-rows'),
        value: cell.result?.passedRows,
      },
      {
        key: 'failedRows',
        label: t('label.failed-rows'),
        value: cell.result?.failedRows,
      },
      {
        key: 'impactScore',
        label: t('label.impact-score'),
        value: cell.result?.impactScore?.toFixed(2),
      },
    ],
    [cell, t]
  );

  return (
    <Card
      sx={(theme) => ({
        p: TOOLTIP_STYLES.CARD_PADDING,
        bgcolor: theme.palette.allShades.white,
      })}>
      <Typography
        sx={(theme) => ({
          color: theme.palette.allShades.gray[900],
          fontWeight: theme.typography.fontWeightMedium,
          fontSize: theme.typography.pxToRem(TOOLTIP_STYLES.HEADER_FONT_SIZE),
        })}>
        {cell.date}
      </Typography>
      <Divider
        sx={(theme) => ({
          my: TOOLTIP_STYLES.DIVIDER_MARGIN,
          borderStyle: 'dashed',
          borderColor: theme.palette.allShades.gray[300],
        })}
      />
      <Stack spacing={TOOLTIP_STYLES.STACK_SPACING}>
        {rows.map(
          (row) =>
            !isUndefined(row.value) && (
              <TooltipRow key={row.key} label={row.label} value={row.value} />
            )
        )}
        {cell.result?.testResultValue &&
          cell.result.testResultValue.length > 0 &&
          cell.result.testResultValue.map((resultValue, index) => (
            <TooltipRow
              key={`result-value-${index}`}
              label={resultValue.name || t('label.value')}
              value={resultValue.value || '-'}
            />
          ))}
      </Stack>
    </Card>
  );
};
