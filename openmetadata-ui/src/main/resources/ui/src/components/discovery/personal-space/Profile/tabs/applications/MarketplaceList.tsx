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
  EmptyPlaceholder,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import { GridView } from '@openmetadata/ui-core-components/icons';
import { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCursorPagedList } from '../../../../../../hooks/useCursorPagedList';
import { getMarketPlaceApplicationList } from '../../../../../../rest/applicationMarketPlaceAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import ApplicationCard from './ApplicationCard';
import type { ApplicationsViewProps } from './Applications.types';
import {
  ApplicationsGrid,
  ApplicationsPagination,
  CARD_SPAN,
} from './ApplicationsList';

const MarketplaceList: FC<ApplicationsViewProps> = ({
  onNavigate,
  onHeaderChange,
}) => {
  const { t } = useTranslation();
  const {
    items: apps,
    isLoading,
    showPagination,
    ...pagination
  } = useCursorPagedList(getMarketPlaceApplicationList);

  useEffect(() => {
    onHeaderChange({
      title: t('label.market-place'),
      description: t('message.marketplace-settings-description'),
      crumb: t('label.market-place'),
    });
  }, [onHeaderChange, t]);

  return (
    <Box className="tw:px-8 tw:pb-8" direction="col" gap={4}>
      <Typography
        className="tw:text-secondary tw:uppercase"
        size="text-xs"
        weight="semibold">
        {t('label.available-application-plural')}
      </Typography>
      {!isLoading && apps.length === 0 ? (
        <Box className="tw:relative tw:min-h-90">
          <EmptyPlaceholder
            data-testid="no-marketplace-applications"
            icon={GridView}
            title={t('label.no-entity', {
              entity: t('label.application-plural'),
            })}
          />
        </Box>
      ) : (
        <ApplicationsGrid isLoading={isLoading}>
          {apps.map((app) => (
            <Grid.Item key={app.id} span={CARD_SPAN}>
              <ApplicationCard
                appName={app.name}
                description={app.description}
                title={getEntityName(app)}
                onClick={() =>
                  onNavigate({
                    type: 'marketplace-detail',
                    fqn: app.fullyQualifiedName ?? app.name,
                  })
                }
              />
            </Grid.Item>
          ))}
        </ApplicationsGrid>
      )}
      {showPagination && <ApplicationsPagination {...pagination} />}
    </Box>
  );
};

export default MarketplaceList;
