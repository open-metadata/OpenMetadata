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

import { Box, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as RightArrowIcon } from '../../../../../assets/svg/right-arrow.svg';
import { HEATMAP_TOOLTIP_SLOT_PROPS } from './DimensionalityHeatmap.constants';
import { DimensionalityHeatmapProps } from './DimensionalityHeatmap.interface';
import './DimensionalityHeatmap.less';
import {
  generateDateRange,
  getDateLabel,
  getStatusLabel,
  transformDimensionResultsToHeatmapData,
} from './DimensionalityHeatmap.utils';
import { HeatmapCellTooltip } from './HeatmapCellTooltip.component';
import { useScrollIndicator } from './useScrollIndicator.hook';

const DimensionalityHeatmap = ({
  data,
  startDate,
  endDate,
  isLoading = false,
}: DimensionalityHeatmapProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const dateRange = useMemo(
    () => generateDateRange(startDate, endDate),
    [startDate, endDate]
  );

  const heatmapData = useMemo(
    () => transformDimensionResultsToHeatmapData(data, startDate, endDate),
    [data, startDate, endDate]
  );

  const {
    showLeftIndicator,
    showRightIndicator,
    handleScrollLeft,
    handleScrollRight,
  } = useScrollIndicator(containerRef, [heatmapData]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [startDate, endDate]);

  if (isLoading) {
    return (
      <Box className="dimensionality-heatmap__loading">
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box className="dimensionality-heatmap__empty">
        <Typography>{t('message.no-data-available')}</Typography>
      </Box>
    );
  }

  return (
    <Box
      aria-label={t('label.dimensionality')}
      className="dimensionality-heatmap">
      <Box className="dimensionality-heatmap__layout">
        <Box className="dimensionality-heatmap__labels-column">
          <Box className="dimensionality-heatmap__header-corner" />
          {heatmapData.map((row) => (
            <Tooltip key={row.dimensionValue} title={row.dimensionValue}>
              <Box className="dimensionality-heatmap__dimension-label">
                {row.dimensionValue}
              </Box>
            </Tooltip>
          ))}
        </Box>

        <Box className="dimensionality-heatmap__scroll-wrapper">
          {showLeftIndicator && (
            <Box
              aria-label={`${t('label.scroll')} ${t('label.left')}`}
              className="dimensionality-heatmap__scroll-indicator dimensionality-heatmap__scroll-indicator--left"
              tabIndex={0}
              onClick={handleScrollLeft}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleScrollLeft();
                }
              }}>
              <RightArrowIcon />
            </Box>
          )}

          <Box
            className="dimensionality-heatmap__scroll-container"
            ref={containerRef}>
            <Box className="dimensionality-heatmap__header-row">
              {dateRange.map((date) => (
                <Box
                  aria-label={getDateLabel(date)}
                  className="dimensionality-heatmap__header-cell"
                  key={date}>
                  {getDateLabel(date)}
                </Box>
              ))}
            </Box>

            {heatmapData.map((row) => (
              <Box
                className="dimensionality-heatmap__data-row"
                key={`row-${row.dimensionValue}`}>
                {row.cells.map((cell) => (
                  <Tooltip
                    key={`${cell.dimensionValue}-${cell.date}`}
                    placement="top"
                    slotProps={HEATMAP_TOOLTIP_SLOT_PROPS}
                    title={<HeatmapCellTooltip cell={cell} />}>
                    <Box
                      aria-label={`${cell.dimensionValue}, ${getDateLabel(
                        cell.date
                      )}: ${getStatusLabel(cell.status, t)}`}
                      className={`dimensionality-heatmap__cell dimensionality-heatmap__cell--${cell.status}`}
                    />
                  </Tooltip>
                ))}
              </Box>
            ))}
          </Box>

          {showRightIndicator && (
            <Box
              aria-label={`${t('label.view')} ${t('label.more')}`}
              className="dimensionality-heatmap__scroll-indicator dimensionality-heatmap__scroll-indicator--right"
              tabIndex={0}
              onClick={handleScrollRight}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleScrollRight();
                }
              }}>
              <RightArrowIcon />
            </Box>
          )}
        </Box>
      </Box>

      <Box className="dimensionality-heatmap__legend">
        <Box className="dimensionality-heatmap__legend-item">
          <Box className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--success" />
          {t('label.success')}
        </Box>
        <Box className="dimensionality-heatmap__legend-item">
          <Box className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--failed" />
          {t('label.failed')}
        </Box>
        <Box className="dimensionality-heatmap__legend-item">
          <Box className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--aborted" />
          {t('label.aborted')}
        </Box>
        <Box className="dimensionality-heatmap__legend-item">
          <Box className="dimensionality-heatmap__legend-box dimensionality-heatmap__legend-box--no-data" />
          {t('label.no-data')}
        </Box>
      </Box>
    </Box>
  );
};

export default DimensionalityHeatmap;
