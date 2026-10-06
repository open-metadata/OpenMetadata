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
import { ROUTES } from '../../../../constants/constants';
import { getDataProductDetailsPath } from '../../../../utils/RouterUtils';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import FilterButton from '../Common/TopicWidget/FilterButton';
import TopicCard from '../Common/TopicWidget/TopicCard';
import TopicFilterChips from '../Common/TopicWidget/TopicFilterChips';
import { TopicKey } from '../Common/TopicWidget/topics.types';
import {
  DataProductSummary,
  useDataProducts,
} from '../../../../hooks/useDataProducts';

/** Bucket filters over the products already fetched — no extra request. */
const PRODUCT_FILTERS = {
  ALL: 'all',
  EMPTY: 'empty',
  NO_OWNER: 'noOwner',
} as const;

/** Sorts over the products already fetched — no extra request. */
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
  const {
    products,
    totalCount,
    unownedCount,
    emptyCount,
    domainCount,
    isError,
    isLoading,
  } = useDataProducts();
  const [filter, setFilter] = useState<string>(PRODUCT_FILTERS.ALL);
  const [sort, setSort] = useState<string>(PRODUCT_SORTS.MOST_ASSETS);

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

  const visibleProducts = useMemo(() => {
    const matches = (product: DataProductSummary) => {
      if (filter === PRODUCT_FILTERS.NO_OWNER) {
        return !product.ownerName;
      }
      if (filter === PRODUCT_FILTERS.EMPTY) {
        return product.assetCount === 0;
      }

      return true;
    };

    // `filter` hands back a fresh array, so sorting it in place is safe —
    // `products` itself must never be sorted, it is the hook's own result.
    return products
      .filter(matches)
      .sort(BY_SORT[sort] ?? BY_SORT[PRODUCT_SORTS.MOST_ASSETS]);
  }, [products, filter, sort]);

  const summary = isError
    ? t('message.something-went-wrong')
    : t('message.count-products-across-domains', {
        count: totalCount,
        domains: domainCount,
      });

  return (
    <TopicCard
      action={{
        label: t('label.view-all-entity', { entity: t(PRODUCTS_LABEL_KEY) }),
        onPress: () => navigate(ROUTES.DATA_PRODUCT),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isLoading={isLoading}
      meta={t('message.count-products', { count: totalCount })}
      status={{
        color: 'gray',
        label: t('message.count-products', { count: totalCount }),
      }}
      summary={summary}
      title={t(PRODUCTS_LABEL_KEY)}
      tone={TONE}
      topicKey={TopicKey.DATA_PRODUCTS}
      widgetKey={widgetKey}>
      {products.length === 0 ? (
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
                  id: PRODUCT_FILTERS.ALL,
                  label: t('label.all'),
                  tone: 'brand',
                },
                {
                  count: unownedCount,
                  id: PRODUCT_FILTERS.NO_OWNER,
                  label: t(NO_OWNER_LABEL_KEY),
                  tone: 'warning',
                },
                {
                  count: emptyCount,
                  id: PRODUCT_FILTERS.EMPTY,
                  label: t('label.empty'),
                  tone: 'muted',
                },
              ]}
              label={t(PRODUCTS_LABEL_KEY)}
              value={filter}
              onChange={setFilter}
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
              <li key={product.id}>
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
                            ellipsis={{ rows: 1 }}
                            size="text-sm">
                            {product.domainName}
                          </Typography>
                        </>
                      )}
                      <Typography
                        className={
                          product.ownerName
                            ? 'tw:min-w-0 tw:text-text-tertiary!'
                            : 'tw:min-w-0 tw:text-utility-warning-700!'
                        }
                        ellipsis={{ rows: 1 }}
                        size="text-sm">
                        {product.domainName
                          ? `· ${product.ownerName ?? t(NO_OWNER_LABEL_KEY)}`
                          : product.ownerName ?? t(NO_OWNER_LABEL_KEY)}
                      </Typography>
                    </span>
                  </div>
                  <Badge
                    className="tw:shrink-0"
                    color="gray"
                    size="sm"
                    type="pill-color">
                    {`${product.assetCount} ${t('label.asset-plural')}`}
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
