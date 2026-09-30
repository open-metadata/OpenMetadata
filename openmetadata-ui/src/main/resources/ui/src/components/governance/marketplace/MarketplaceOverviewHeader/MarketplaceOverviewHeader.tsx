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

import { PageLayout } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MarketplaceIcon } from '../../../../assets/svg/marketplace-default.svg';
import { ROUTES } from '../../../../constants/constants';
import HeaderBreadcrumb from '../../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { SearchHeaderRow } from '../../../common/ListPageHeader/ListPageHeader';
import MarketplaceSearchInput from '../../../DataMarketplace/MarketplaceSearchInput/MarketplaceSearchInput.component';
import { AddNewMenu } from '../AddNewMenu/AddNewMenu';

/**
 * Data Marketplace overview page header. Renders the shared `PageHeader`
 * gradient chrome — marketplace breadcrumb, "Data Marketplace" title and
 * subtitle — with the existing marketplace search alongside the "Add New" menu,
 * replacing the classic greeting banner + standalone search bar. Spacing
 * (breadcrumb→title, title→subtitle, action gap, padding) is owned by
 * `PageHeader` per the Figma spec.
 */
export const MarketplaceOverviewHeader: FC = () => {
  const { t } = useTranslation();

  return (
    <PageLayout.PageHeader
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
      className="tw:mb-4"
      data-testid="marketplace-overview-header"
      title={
        <SearchHeaderRow
          actions={<AddNewMenu />}
          search={
            <MarketplaceSearchInput
              placeholder={t('label.search-for-type', {
                type: `${t('label.data-product-plural')}, ${t(
                  'label.domain-plural'
                )}`,
              })}
            />
          }
          subtitle={t('message.discover-data-products-subtitle')}
          title={t('label.data-marketplace')}
        />
      }
      variant="gradient"
    />
  );
};

export default MarketplaceOverviewHeader;
