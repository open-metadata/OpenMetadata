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
import { ROUTES } from '../../../../constants/constants';
import { getDomainPath } from '../../../../utils/RouterUtils';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import TopicCard from '../Common/TopicWidget/TopicCard';
import TopicFilterChips from '../Common/TopicWidget/TopicFilterChips';
import { TopicKey } from '../Common/TopicWidget/topics.types';
import { useDomainOverview } from '../../../../hooks/useDomainOverview';

/** Bucket filters over the domains already fetched — no extra request. */
const DOMAIN_FILTERS = {
  ALL: 'all',
  EMPTY: 'empty',
  NO_OWNER: 'noOwner',
} as const;

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
  const { domains, totalCount, unownedCount, emptyCount, isError, isLoading } =
    useDomainOverview();
  const [filter, setFilter] = useState<string>(DOMAIN_FILTERS.ALL);

  const visibleDomains = useMemo(() => {
    if (filter === DOMAIN_FILTERS.NO_OWNER) {
      return domains.filter((domain) => !domain.ownerName);
    }
    if (filter === DOMAIN_FILTERS.EMPTY) {
      return domains.filter((domain) => domain.assetCount === 0);
    }

    return domains;
  }, [domains, filter]);

  const remaining = Math.max(0, totalCount - domains.length);

  const summary = isError
    ? t('message.something-went-wrong')
    : [
        t('message.count-unowned', { count: unownedCount }),
        t('message.count-total-tests', { count: totalCount }),
      ].join(' · ');

  return (
    <TopicCard
      action={{
        label: t('label.view-all-entity', { entity: t(DOMAINS_LABEL_KEY) }),
        onPress: () => navigate(ROUTES.DOMAIN),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
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
      summary={summary}
      title={t(DOMAINS_LABEL_KEY)}
      tone={TONE}
      topicKey={TopicKey.DOMAINS}
      widgetKey={widgetKey}>
      {domains.length === 0 ? (
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
                id: DOMAIN_FILTERS.ALL,
                label: t('label.all'),
                tone: 'brand',
              },
              {
                count: unownedCount,
                id: DOMAIN_FILTERS.NO_OWNER,
                label: t('label.no-owner'),
                tone: 'warning',
              },
              {
                count: emptyCount,
                id: DOMAIN_FILTERS.EMPTY,
                label: t('label.empty'),
                tone: 'muted',
              },
            ]}
            label={t(DOMAINS_LABEL_KEY)}
            value={filter}
            onChange={setFilter}
          />

          <ul
            className="tw:mt-3 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
            data-testid="domain-rows">
            {visibleDomains.map((domain) => (
              <li key={domain.id}>
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
                    size="sm"
                    type="pill-color">
                    {`${domain.assetCount} ${t('label.asset-plural')}`}
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
