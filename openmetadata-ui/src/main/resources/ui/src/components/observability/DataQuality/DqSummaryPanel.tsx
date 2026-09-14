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
import { Box, Skeleton, Typography } from '@openmetadata/ui-core-components';
import { formatNumberWithComma } from '../../../utils/NumberUtils';
import { SummaryDonut } from '../../DataQuality/SummaryPannel/SummaryDonut.component';
import {
  SummaryPanelProps,
  TestSummaryCardKey,
} from '../../DataQuality/SummaryPannel/SummaryPanel.interface';
import { useTestSummaryCards } from '../../DataQuality/SummaryPannel/useTestSummaryCards';
import { SEGMENT_COLORS } from './DqSummaryPanel.constants';

const CARD_CLASS =
  'tw:flex-1 tw:rounded-xl tw:bg-primary tw:px-6 tw:py-5 tw:shadow-xs tw:outline-1 tw:outline-secondary';

/**
 * App-mode Data Quality summary cards. The card figures come from the shared
 * useTestSummaryCards hook (same source as the classic PieChartSummaryPanel);
 * this component only supplies the untitled-ui card chrome from the 2.0 mock (no
 * icon, brand-blue/semantic palette, borderless donut + inline legend).
 */
const DqSummaryPanel = ({
  testSummary,
  isLoading = false,
}: SummaryPanelProps) => {
  const cards = useTestSummaryCards(testSummary);

  if (isLoading) {
    return (
      <Box align="stretch" gap={4}>
        {cards.map((card) => (
          <Box className={CARD_CLASS} key={card.key}>
            <Skeleton height={82} width="100%" />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box align="stretch" gap={4}>
      {cards.map((card) => {
        const chartData = card.segments.map((segment) => ({
          name: segment.name,
          value: segment.value,
          color: SEGMENT_COLORS[segment.id],
        }));

        return (
          <Box
            align="center"
            className={CARD_CLASS}
            gap={4}
            justify="between"
            key={card.key}>
            <Box direction="col" gap={2}>
              <Typography
                className="tw:whitespace-nowrap"
                size="text-xs"
                weight="semibold">
                {card.title}
              </Typography>
              <Typography size="text-xl" weight="semibold">
                {formatNumberWithComma(card.value)}
              </Typography>
            </Box>
            <Box align="center" gap={3}>
              {card.key === TestSummaryCardKey.TotalTests && (
                <Box direction="col" gap={2}>
                  {chartData.map((item) => (
                    <Box align="center" gap={2} key={item.name}>
                      <span
                        className="tw:size-2 tw:shrink-0 tw:rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <Typography className="tw:whitespace-nowrap tw:text-xs tw:font-medium tw:leading-4 tw:text-tertiary">
                        {item.name}{' '}
                        <span className="tw:font-semibold tw:text-primary">
                          {formatNumberWithComma(item.value)}
                        </span>
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
              <SummaryDonut
                chartData={chartData}
                percentage={card.percentage}
                size={100}
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default DqSummaryPanel;
