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
import { Box, Typography } from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TestCaseStatus } from '../../../../../generated/tests/testCase';
import { formatNumberWithComma } from '../../../../../utils/NumberUtils';
import { getRunSummary } from './RunSummaryTiles.utils';

// An em dash, as in the mock, rather than NO_DATA_PLACEHOLDER's '--': a rate
// with nothing completed to rate is not missing data.
const NO_RATE = '—';

const TILE_CLASS =
  'tw:rounded-xl tw:bg-surface tw:px-4 tw:py-3 tw:outline-1 tw:-outline-offset-1 tw:outline-secondary';

interface RunSummaryTilesProps {
  results: { testCaseStatus?: TestCaseStatus }[];
}

const RunSummaryTiles = ({ results }: RunSummaryTilesProps) => {
  const { t } = useTranslation();

  const tiles = useMemo(() => {
    const summary = getRunSummary(results);

    return [
      {
        key: 'runs',
        label: t('label.run-plural'),
        value: formatNumberWithComma(summary.runs),
      },
      {
        key: 'passed',
        label: t('label.passed'),
        value: formatNumberWithComma(summary.passed),
        className: 'tw:text-success-primary',
      },
      {
        key: 'failed',
        label: t('label.failed'),
        value: formatNumberWithComma(summary.failed),
        className: 'tw:text-error-primary',
      },
      {
        key: 'aborted',
        label: t('label.aborted'),
        value: formatNumberWithComma(summary.aborted),
        className: 'tw:text-warning-primary',
      },
      {
        key: 'success-rate',
        label: t('label.success-rate'),
        value: isUndefined(summary.successRate)
          ? NO_RATE
          : `${summary.successRate}%`,
      },
    ];
  }, [results, t]);

  return (
    // Five across whenever the card is wide enough, as in the mock, wrapping
    // only when a narrow card cannot fit them.
    <div
      className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] tw:gap-3"
      data-testid="run-summary-tiles">
      {tiles.map((tile) => (
        <Box
          className={TILE_CLASS}
          data-testid={`run-summary-${tile.key}`}
          direction="col"
          gap={1}
          key={tile.key}>
          <Typography className="tw:text-tertiary" size="text-sm">
            {tile.label}
          </Typography>
          <Typography
            data-value
            className={tile.className}
            size="display-xs"
            weight="semibold">
            {tile.value}
          </Typography>
        </Box>
      ))}
    </div>
  );
};

export default RunSummaryTiles;
