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
import { Lock01, Sort } from '@openmetadata/ui-core-components/icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import {
  CuratedAssetsSource,
  useCuratedAssets,
} from '../../../../hooks/useCuratedAssets';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import { DEFAULT_CURATED_RULE } from '../../../../utils/curatedRule';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';

const TONE = {
  icon: Sort,
  tile: 'tw:bg-utility-indigo-50 tw:text-utility-indigo-600',
};

export type CuratedAssetsSummaryWidgetProps = WidgetCommonProps;

/** The assets matching a saved rule, e.g. certified Tier-1 tables. */
const CuratedAssetsSummaryWidget: React.FC<CuratedAssetsSummaryWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
  widgetConfig,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // An admin-saved advanced filter wins over the built-in chip rule — see
  // CuratedAssetsSource. Memoised because it is part of the query key.
  const source = useMemo<CuratedAssetsSource>(
    () => ({
      queryFilter: widgetConfig?.config?.queryFilter as string | undefined,
      resources: widgetConfig?.config?.resources as string[] | undefined,
      rule: DEFAULT_CURATED_RULE,
    }),
    [widgetConfig?.config]
  );
  const hasSavedFilter = Boolean(source.queryFilter);
  const savedTitle = widgetConfig?.config?.title as string | undefined;

  const { assets, totalCount, isError, isLoading } = useCuratedAssets(source);

  // Chips describe the built-in rule only; a saved advanced filter is arbitrary
  // JSON that cannot be rendered back as `<field> is <value>` clauses.
  const ruleClauses = hasSavedFilter ? [] : DEFAULT_CURATED_RULE;
  const ruleText = ruleClauses
    .map((clause) => `${t(clause.labelKey)} is ${clause.displayValue}`)
    .join(', ');
  const remaining = Math.max(0, totalCount - assets.length);

  return (
    <TopicCard
      action={{
        label: t('label.view-all-entity', { entity: t('label.match-plural') }),
        onPress: () => navigate(ROUTES.EXPLORE),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isLoading={isLoading}
      meta={
        remaining > 0
          ? t('message.count-more-assets-match-rule', { count: remaining })
          : undefined
      }
      status={{
        color: 'gray',
        label: t('message.count-assets-match-rule', { count: totalCount }),
      }}
      summary={
        isError
          ? t('message.something-went-wrong')
          : [
              t('message.count-assets-match-rule', { count: totalCount }),
              ruleText,
            ]
              .filter(Boolean)
              .join(' · ')
      }
      title={savedTitle || t('label.curated-assets')}
      tone={TONE}
      topicKey={TopicKey.CURATED_ASSETS}
      widgetKey={widgetKey}>
      {/* The rule itself, so the list is never an unexplained set of rows. */}
      {ruleClauses.length > 0 && (
        <div className="tw:rounded-xl tw:bg-secondary tw:p-3.5">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            {/* `!` on the colours throughout: Typography renders `.prose`, whose
            unlayered `color` rule is emitted after the Tailwind utilities. */}
            <Typography
              className="tw:text-text-tertiary! tw:uppercase"
              size="text-xs"
              weight="semibold">
              {t('label.rule')}
            </Typography>
            {ruleClauses.map((clause, index) => (
              <React.Fragment key={clause.termKey}>
                {index > 0 && (
                  <Typography className="tw:text-text-tertiary!" size="text-xs">
                    {t('label.and-lowercase')}
                  </Typography>
                )}
                <Badge color="gray" size="sm" type="color">
                  {`${t(clause.labelKey)} ${clause.displayValue}`}
                </Badge>
              </React.Fragment>
            ))}
          </div>
          <div className="tw:mt-2 tw:flex tw:items-center tw:gap-1.5">
            <Lock01
              aria-hidden
              className="tw:shrink-0 tw:text-text-tertiary"
              height={12}
              width={12}
            />
            <Typography className="tw:text-text-tertiary!" size="text-xs">
              {t('message.set-in-persona-settings')}
            </Typography>
          </div>
        </div>
      )}

      {assets.length > 0 && (
        <div className="tw:@container tw:mt-4">
          <ul
            className="tw:grid tw:grid-cols-1 tw:gap-2 tw:@md:grid-cols-2"
            data-testid="curated-assets-rows">
            {assets.map((asset) => (
              <li key={asset.id}>
                <Link
                  className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5 tw:rounded-lg tw:bg-secondary tw:px-3 tw:py-2.5"
                  to={entityUtilClassBase.getEntityLink(
                    asset.entityType,
                    asset.fullyQualifiedName
                  )}>
                  {asset.serviceType && (
                    <img
                      alt=""
                      className="tw:size-4 tw:shrink-0 tw:object-contain"
                      height={16}
                      src={serviceUtilClassBase.getServiceLogo(
                        asset.serviceType
                      )}
                      width={16}
                    />
                  )}
                  <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
                    <Typography
                      className="tw:min-w-0 tw:text-text-primary!"
                      ellipsis={{ rows: 1 }}
                      size="text-sm">
                      {asset.name}
                    </Typography>
                    {asset.tier && (
                      <Typography
                        className="tw:min-w-0 tw:text-text-tertiary!"
                        ellipsis={{ rows: 1 }}
                        size="text-xs">
                        {asset.tier}
                      </Typography>
                    )}
                  </span>
                  <span
                    // Colour alone must not carry the meaning, so the dot has
                    // a text alternative for assistive tech.
                    aria-label={
                      asset.isHealthy ? t('label.healthy') : t('label.failing')
                    }
                    className={`tw:size-2 tw:shrink-0 tw:rounded-full ${
                      asset.isHealthy
                        ? 'tw:bg-utility-success-500'
                        : 'tw:bg-utility-error-500'
                    }`}
                    role="img"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </TopicCard>
  );
};

export default CuratedAssetsSummaryWidget;
