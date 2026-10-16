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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExploreHeaderIcon } from '../../../../assets/svg/explore-header-icon.svg';
import {
  GRAY_700,
  TEST_STATUS_COLORS,
} from '../../../../constants/Color.constants';

export interface ExploreSearchCardInfoProps {
  assetCount: number | null;
}

export const ExploreSearchCardInfo = ({
  assetCount,
}: ExploreSearchCardInfoProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:relative tw:mr-5 tw:shrink-0 tw:self-start">
      <Box align="start" className="tw:flex tw:gap-4" direction="row">
        <ExploreHeaderIcon
          className="tw:mt-1.5 tw:size-10 tw:shrink-0"
          data-testid="explore-search-card-icon"
        />
        <div className="tw:flex tw:min-w-0 tw:flex-col">
          <div className="tw:flex tw:flex-col tw:gap-0.5">
            <Typography
              as="h3"
              className="tw:text-xl tw:font-semibold tw:leading-[30px] tw:text-primary"
              data-testid="explore-search-card-title"
              size="text-xl"
              weight="semibold">
              {t('label.explore-title')}
            </Typography>
          </div>
          <div
            className="tw:mt-1 tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:leading-[18px] tw:text-secondary"
            data-testid="explore-search-card-stats">
            {assetCount !== null && (
              <>
                <span
                  className="tw:inline-block tw:size-1.5 tw:rounded-full"
                  style={{ backgroundColor: TEST_STATUS_COLORS.SUCCESS }}
                />
                <span>
                  <b className="tw:font-semibold" style={{ color: GRAY_700 }}>
                    {assetCount.toLocaleString()}
                  </b>{' '}
                  {t('message.explore-assets-indexed-suffix')}
                </span>
              </>
            )}
          </div>
        </div>
      </Box>
    </div>
  );
};
