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
import {
  Cube01 as DataProduct,
  Globe01 as Domain,
} from '@openmetadata/ui-core-components/icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import {
  DataProductSummary,
  useDataProducts,
} from '../../../../hooks/useDataProducts';
import { OverviewFilter } from '../../../../hooks/useDomainOverview';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import { getDataProductDetailsPath } from '../../../../utils/RouterUtils';
import FilterButton from '../Common/TopicWidget/FilterButton';
import TopicCard from '../Common/TopicWidget/TopicCard';
import TopicFilterChips from '../Common/TopicWidget/TopicFilterChips';
import { TopicKey } from '../Common/TopicWidget/topics.types';

/**
 * Sorts over the page already fetched — no extra request. The bucket chips are
 * queried server-side; the order within the page they return is the card's.
 */
const PRODUCT_SORTS = {
  MOST_ASSETS: 'mostAssets',
  RECENTLY_UPDATED: 'recentlyUpdated',
  NEEDS_ATTENTION: 'needsAttention',
  ALPHABETICAL: 'alphabetical',
} as const;

/**
 * How badly a product wants looking at: an unowned product and an empty one are
 * each one problem, and a product that is both outranks either.
 */
const attentionScore = (product: DataProductSummary): number =>
  (product.ownerName ? 0 : 1) + (product.assetCount === 0 ? 1 : 0);

const BY_SORT: Record<
  string,
  (a: DataProductSummary, b: DataProductSummary) => number
> = {
  [PRODUCT_SORTS.MOST_ASSETS]: (a, b) => b.assetCount - a.assetCount,
  [PRODUCT_SORTS.RECENTLY_UPDATED]: (a, b) => b.updatedAt - a.updatedAt,
  // Alphabetical second, so an unowned-and-empty block keeps a stable reading order.
  [PRODUCT_SORTS.NEEDS_ATTENTION]: (a, b) =>
    attentionScore(b) - attentionScore(a) || a.name.localeCompare(b.name),
  [PRODUCT_SORTS.ALPHABETICAL]: (a, b) => a.name.localeCompare(b.name),
};

const PRODUCTS_LABEL_KEY = 'label.data-product-plural';
const NO_OWNER_LABEL_KEY = 'label.no-owner';

const TONE = {
  icon: DataProduct,
  tile: 'tw:bg-utility-blue-50 tw:text-utility-blue-600',
};

export type DataProductsOverviewWidgetProps = WidgetCommonProps;

/** The estate's data products, who owns them, and how much they hold. */
const DataProductsOverviewWidget: React.FC<DataProductsOverviewWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<OverviewFilter>(OverviewFilter.ALL);
  const [sort, setSort] = useState<string>(PRODUCT_SORTS.MOST_ASSETS);
  // Each bucket is queried, not filtered out of the rows in hand — the rows are
  // one page, and a chip counted or filtered over a page describes the page.
  const {
    products,
    totalCount,
    unownedCount,
    emptyCount,
    domainCount,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useDataProducts(filter);

  const sortOptions = useMemo(
    () => [
      { label: t('label.most-assets'), value: PRODUCT_SORTS.MOST_ASSETS },
      {
        label: t('label.recently-updated'),
        value: PRODUCT_SORTS.RECENTLY_UPDATED,
      },
      {
        label: t('label.needs-attention'),
        value: PRODUCT_SORTS.NEEDS_ATTENTION,
      },
      { label: t('label.a-z'), value: PRODUCT_SORTS.ALPHABETICAL },
    ],
    [t]
  );

  // A copy, so sorting in place never reorders the hook's own result.
  const visibleProducts = useMemo(
    () =>
      [...products].sort(BY_SORT[sort] ?? BY_SORT[PRODUCT_SORTS.MOST_ASSETS]),
    [products, sort]
  );

  const bucketSize: Record<OverviewFilter, number> = {
    [OverviewFilter.ALL]: totalCount,
    [OverviewFilter.NO_OWNER]: unownedCount,
    [OverviewFilter.EMPTY]: emptyCount,
  };
  const remaining = Math.max(0, bucketSize[filter] - products.length);

  return (
    <TopicCard
      action={{
        label: t('label.view-all-entity', { entity: t(PRODUCTS_LABEL_KEY) }),
        onPress: () => navigate(ROUTES.DATA_PRODUCT),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isFetching={isFetching}
      isLoading={isLoading}
      meta={
        remaining > 0
          ? t('message.count-more-data-products', { count: remaining })
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
      summary={t('message.count-products-across-domains', {
        count: totalCount,
        domains: domainCount,
      })}
      title={t(PRODUCTS_LABEL_KEY)}
      tone={TONE}
      topicKey={TopicKey.DATA_PRODUCTS}
      widgetKey={widgetKey}
      onRetry={refetch}>
      {totalCount === 0 ? (
        // `!` on the colours throughout: Typography renders `.prose`, whose
        // unlayered `color` rule is emitted after the Tailwind utilities.
        <Typography className="tw:text-text-secondary!" size="text-sm">
          {t('message.no-data-products-yet')}
        </Typography>
      ) : (
        <>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
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
                  label: t(NO_OWNER_LABEL_KEY),
                  tone: 'warning',
                },
                {
                  count: emptyCount,
                  id: OverviewFilter.EMPTY,
                  label: t('label.empty'),
                  tone: 'muted',
                },
              ]}
              label={t(PRODUCTS_LABEL_KEY)}
              testIdPrefix="data-products"
              value={filter}
              onChange={(next) => setFilter(next as OverviewFilter)}
            />
            <FilterButton
              label={t('label.sort-by')}
              options={sortOptions}
              testId="data-product-sort-filter"
              value={sort}
              onChange={setSort}
            />
          </div>

          <ul
            className="tw:mt-3 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
            data-testid="data-product-rows">
            {visibleProducts.map((product) => (
              <li
                data-testid={`data-product-card-${product.id}`}
                key={product.id}>
                <Link
                  className="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:py-3"
                  to={getDataProductDetailsPath(product.fullyQualifiedName)}>
                  <div
                    aria-hidden
                    className="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-utility-blue-50 tw:text-utility-blue-600">
                    <DataProduct size={16} />
                  </div>
                  <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
                    <Typography
                      className="tw:min-w-0 tw:text-text-primary!"
                      data-testid="data-product-name"
                      ellipsis={{ rows: 1 }}
                      size="text-sm"
                      weight="medium">
                      {product.name}
                    </Typography>
                    <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-1.5">
                      {product.domainName && (
                        <>
                          <Domain
                            aria-hidden
                            className="tw:shrink-0 tw:text-text-tertiary"
                            size={12}
                          />
                          <Typography
                            className="tw:min-w-0 tw:text-text-tertiary!"
                            data-testid="data-product-domain"
                            ellipsis={{ rows: 1 }}
                            size="text-sm">
                            {product.domainName}
                          </Typography>
                          {/* Drawn, not spliced into the owner's string. */}
                          <span
                            aria-hidden
                            className="tw:size-1 tw:shrink-0 tw:rounded-full tw:bg-fg-quaternary"
                          />
                        </>
                      )}
                      <Typography
                        className={
                          product.ownerName
                            ? 'tw:min-w-0 tw:text-text-tertiary!'
                            : 'tw:min-w-0 tw:text-utility-warning-700!'
                        }
                        data-testid="data-product-owner"
                        ellipsis={{ rows: 1 }}
                        size="text-sm">
                        {product.ownerName ?? t(NO_OWNER_LABEL_KEY)}
                      </Typography>
                    </span>
                  </div>
                  <Badge
                    className="tw:shrink-0"
                    color="gray"
                    data-testid="data-product-asset-count"
                    size="sm"
                    type="pill-color">
                    {t('label.count-asset', { count: product.assetCount })}
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

export default DataProductsOverviewWidget;
