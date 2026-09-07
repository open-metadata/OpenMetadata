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
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MarketplaceIcon } from '../../../../assets/svg/marketplace-default.svg';
import { ROUTES } from '../../../../constants/constants';
import HeaderBreadcrumb from '../../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../../../common/HeaderShell/HeaderShell.component';
import MarketplaceSearchBar from '../../../DataMarketplace/MarketplaceSearchBar/MarketplaceSearchBar.component';
import { AddNewMenu } from '../AddNewMenu/AddNewMenu';

/**
 * Data Marketplace overview page header. Renders the shared `HeaderShell`
 * gradient chrome — marketplace breadcrumb, "Data Marketplace" title and
 * subtitle — with the existing marketplace search alongside the "Add New" menu,
 * replacing the classic greeting banner + standalone search bar. Spacing
 * (breadcrumb→title, title→subtitle, action gap, padding) is owned by
 * `HeaderShell` per the Figma spec.
 */
export const MarketplaceOverviewHeader: FC = () => {
  const { t } = useTranslation();

  // HeaderShell's title slot owns the full content width. Keeping the text and
  // controls in one row mirrors Explore and lets the search center correctly.
  const headerLayout = (
    <Box
      align="start"
      className="tw:w-full tw:min-w-0 tw:flex-1"
      data-testid="marketplace-header-layout"
      direction="row"
      gap={4}>
      <div className="tw:shrink-0">
        <Typography as="h3" size="text-xl" weight="semibold">
          {t('label.data-marketplace')}
        </Typography>
        <Typography className="tw:text-secondary" size="text-sm">
          {t('message.discover-data-products-subtitle')}
        </Typography>
      </div>
      <div
        className="tw:mx-auto tw:flex tw:w-full tw:max-w-5xl tw:min-w-0 tw:flex-1 tw:items-center tw:gap-4 tw:px-8"
        data-testid="marketplace-actions-group">
        <div className="tw:w-full tw:min-w-0 tw:flex-1">
          <MarketplaceSearchBar compact />
        </div>
        <AddNewMenu />
      </div>
    </Box>
  );

  return (
    <HeaderShell
      breadcrumb={
        <HeaderBreadcrumb
          noMargin
          items={[
            {
              label: '',
              ariaLabel: t('label.data-marketplace'),
              icon: MarketplaceIcon,
              href: ROUTES.DATA_MARKETPLACE,
            },
            { label: t('label.data-marketplace') },
          ]}
          showHome={false}
        />
      }
      className="tw:mb-5"
      data-testid="marketplace-overview-header"
      title={headerLayout}
      variant="gradient"
    />
  );
};

export default MarketplaceOverviewHeader;
