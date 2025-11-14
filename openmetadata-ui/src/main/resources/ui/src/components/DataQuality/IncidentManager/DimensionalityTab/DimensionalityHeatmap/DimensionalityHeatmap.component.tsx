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
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as RightArrowIcon } from '../../../../../assets/svg/right-arrow.svg';
import { HEATMAP_CONSTANTS } from './DimensionalityHeatmap.constants';
import { DimensionalityHeatmapProps } from './DimensionalityHeatmap.interface';
import './DimensionalityHeatmap.less';
import {
  calculatePlaceholderCells,
  generateDateRange,
  getDateLabel,
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const dateRange = useMemo(
    () => generateDateRange(startDate, endDate),
    [startDate, endDate]
  );

  const heatmapData = useMemo(
    () => transformDimensionResultsToHeatmapData(data, startDate, endDate),
    [data, startDate, endDate]
  );

  const placeholderCount = useMemo(
    () => calculatePlaceholderCells(dateRange.length, containerWidth),
    [dateRange.length, containerWidth]
  );

  const totalColumns = dateRange.length + placeholderCount;

  const { showScrollIndicator, handleScrollRight } = useScrollIndicator(
    containerRef,
    [heatmapData]
  );

  useEffect(() => {
    const updateWidth = () => {
      if (wrapperRef.current) {
        setContainerWidth(wrapperRef.current.clientWidth);
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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
    <Box className="dimensionality-heatmap">
      <Box className="dimensionality-heatmap__wrapper" ref={wrapperRef}>
        <Box className="dimensionality-heatmap__container" ref={containerRef}>
          <Box
            className="dimensionality-heatmap__grid"
            sx={{
              gridTemplateColumns: `${HEATMAP_CONSTANTS.DIMENSION_LABEL_WIDTH_PX} repeat(${totalColumns}, ${HEATMAP_CONSTANTS.CELL_WIDTH_PX})`,
            }}>
            <Box className="dimensionality-heatmap__header-corner" />
            {dateRange.map((date) => (
              <Box className="dimensionality-heatmap__header-cell" key={date}>
                {getDateLabel(date)}
              </Box>
            ))}
            {Array.from({ length: placeholderCount }).map((_, index) => (
              <Box
                className="dimensionality-heatmap__header-cell dimensionality-heatmap__header-cell--placeholder"
                key={`placeholder-header-${index}`}
              />
            ))}

            {heatmapData.map((row) => (
              <Fragment key={`row-${row.dimensionValue}`}>
                <Tooltip title={row.dimensionValue}>
                  <Box className="dimensionality-heatmap__dimension-label">
                    {row.dimensionValue}
                  </Box>
                </Tooltip>

                {row.cells.map((cell) => (
                  <Tooltip
                    key={`${cell.dimensionValue}-${cell.date}`}
                    placement="right"
                    slotProps={{
                      tooltip: {
                        sx: {
                          backgroundColor: 'transparent',
                          padding: 0,
                          boxShadow: 'none',
                        },
                      },
                    }}
                    title={<HeatmapCellTooltip cell={cell} />}>
                    <Box
                      className={`dimensionality-heatmap__cell dimensionality-heatmap__cell--${cell.status}`}
                    />
                  </Tooltip>
                ))}

                {Array.from({ length: placeholderCount }).map((_, index) => (
                  <Box
                    className="dimensionality-heatmap__cell dimensionality-heatmap__cell--placeholder"
                    key={`placeholder-${row.dimensionValue}-${index}`}
                  />
                ))}
              </Fragment>
            ))}
          </Box>
        </Box>

        {showScrollIndicator && (
          <Box
            className="dimensionality-heatmap__scroll-indicator"
            onClick={handleScrollRight}>
            <RightArrowIcon />
          </Box>
        )}
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
