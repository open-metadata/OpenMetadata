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

import { Badge, Typography } from '@openmetadata/ui-core-components';
import { Globe01 as Domain } from '@openmetadata/ui-core-components/icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import {
  OverviewFilter,
  useDomainOverview,
} from '../../../../hooks/useDomainOverview';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import { getDomainPath } from '../../../../utils/RouterUtils';
import TopicCard from '../Common/TopicWidget/TopicCard';
import TopicFilterChips from '../Common/TopicWidget/TopicFilterChips';
import { TopicKey } from '../Common/TopicWidget/topics.types';

const DOMAINS_LABEL_KEY = 'label.domain-plural';

const TONE = {
  icon: Domain,
  tile: 'tw:bg-utility-blue-50 tw:text-utility-blue-600',
};

export type DomainsOverviewWidgetProps = WidgetCommonProps;

/** The estate's domains, who owns them, and how much they hold. */
const DomainsOverviewWidget: React.FC<DomainsOverviewWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<OverviewFilter>(OverviewFilter.ALL);
  // Each bucket is queried, not filtered out of the rows in hand — the rows are
  // one page, and a chip counted or filtered over a page describes the page.
  const {
    domains,
    totalCount,
    unownedCount,
    emptyCount,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useDomainOverview(filter);

  const bucketSize: Record<OverviewFilter, number> = {
    [OverviewFilter.ALL]: totalCount,
    [OverviewFilter.NO_OWNER]: unownedCount,
    [OverviewFilter.EMPTY]: emptyCount,
  };
  const remaining = Math.max(0, bucketSize[filter] - domains.length);

  return (
    <TopicCard
      action={{
        label: t('label.view-all-entity', { entity: t(DOMAINS_LABEL_KEY) }),
        onPress: () => navigate(ROUTES.DOMAIN),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isFetching={isFetching}
      isLoading={isLoading}
      meta={
        remaining > 0
          ? t('message.count-more-domains', { count: remaining })
          : undefined
      }
      status={
        unownedCount > 0
          ? {
              color: 'warning',
              label: t('message.count-unowned', { count: unownedCount }),
            }
          : undefined
      }
      summary={t('message.count-domains-count-unowned', {
        count: totalCount,
        unowned: unownedCount,
      })}
      title={t(DOMAINS_LABEL_KEY)}
      tone={TONE}
      topicKey={TopicKey.DOMAINS}
      widgetKey={widgetKey}
      onRetry={refetch}>
      {totalCount === 0 ? (
        // `!` on the colours throughout: Typography renders `.prose`, whose
        // unlayered `color` rule is emitted after the Tailwind utilities.
        <Typography className="tw:text-text-secondary!" size="text-sm">
          {t('message.no-domains-yet')}
        </Typography>
      ) : (
        <>
          <TopicFilterChips
            chips={[
              {
                count: totalCount,
                id: OverviewFilter.ALL,
                label: t('label.all'),
                tone: 'brand',
              },
              {
                count: unownedCount,
                id: OverviewFilter.NO_OWNER,
                label: t('label.no-owner'),
                tone: 'warning',
              },
              {
                count: emptyCount,
                id: OverviewFilter.EMPTY,
                label: t('label.empty'),
                tone: 'muted',
              },
            ]}
            label={t(DOMAINS_LABEL_KEY)}
            testIdPrefix="domains"
            value={filter}
            onChange={(next) => setFilter(next as OverviewFilter)}
          />

          <ul
            className="tw:mt-3 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
            data-testid="domain-rows">
            {domains.map((domain) => (
              <li data-testid={`domain-card-${domain.id}`} key={domain.id}>
                <Link
                  className="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:py-3"
                  to={getDomainPath(domain.fullyQualifiedName)}>
                  <div
                    aria-hidden
                    className="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-utility-blue-50 tw:text-utility-blue-600">
                    <Domain size={16} />
                  </div>
                  <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
                    <Typography
                      className="tw:min-w-0 tw:text-text-primary!"
                      data-testid="domain-name"
                      ellipsis={{ rows: 1 }}
                      size="text-sm"
                      weight="medium">
                      {domain.name}
                    </Typography>
                    <Typography
                      className={
                        domain.ownerName
                          ? 'tw:min-w-0 tw:text-text-tertiary!'
                          : 'tw:min-w-0 tw:text-utility-warning-700!'
                      }
                      ellipsis={{ rows: 1 }}
                      size="text-sm">
                      {domain.ownerName ?? t('label.no-owner')}
                    </Typography>
                  </div>
                  <Badge
                    className="tw:shrink-0"
                    color="gray"
                    data-testid="domain-asset-count"
                    size="sm"
                    type="pill-color">
                    {t('label.count-asset', { count: domain.assetCount })}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </TopicCard>
  );
};

export default DomainsOverviewWidget;
