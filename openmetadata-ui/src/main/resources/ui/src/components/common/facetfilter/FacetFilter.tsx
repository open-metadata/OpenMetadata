/*
 *  Copyright 2022 Collate.
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

import { Button, Divider } from 'antd';
import classNames from 'classnames';
import { AggregationEntry } from 'interface/search.interface';
import { isEmpty, isNil, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSortedTierBucketList } from 'utils/EntityUtils';

import {
  compareAggregationKey,
  translateAggregationKeyToTitle,
} from './facetFilter.constants';
import { FacetFilterProps } from './facetFilter.interface';
import FilterContainer from './FilterContainer';

const FacetFilter: React.FC<FacetFilterProps> = ({
  aggregations = {},
  filters = {},
  showDeleted = false,
  onSelectHandler,
  onChangeShowDeleted,
  onClearFilter,
}) => {
  const { t } = useTranslation();
  const [aggregationsPageSize, setAggregationsPageSize] = useState(
    Object.fromEntries(Object.keys(aggregations).map((k) => [k, 5]))
  );
  /**
   * Merging aggregations with filters.
   * The aim is to ensure that if there a filter on aggregationKey `k` with value `v`,
   * but in `aggregations[k]` there is not bucket with value `v`,
   * we add an empty bucket with value `v` and 0 elements so the UI displays that the filter exists.
   */
  const aggregationEntries = useMemo(() => {
    if (isUndefined(aggregations) || isEmpty(aggregations)) {
      return [];
    }

    if (isNil(filters) || isEmpty(filters)) {
      const { 'tier.tagFQN': tier, ...restProps } = aggregations;

      const sortedTiersList = {
        ...tier,
        buckets: getSortedTierBucketList(tier.buckets),
      };

      return Object.entries({ ...restProps, 'tier.tagFQN': sortedTiersList })
        .filter(([, { buckets }]) => buckets.length)
        .sort(([key1], [key2]) => compareAggregationKey(key1, key2));
    }

    const aggregationEntriesWithZeroFilterBuckets: AggregationEntry[] =
      Object.entries(aggregations).map(([aggregationKey, { buckets }]) => [
        aggregationKey,
        {
          buckets:
            aggregationKey in filters
              ? [
                  ...buckets,
                  ...filters[aggregationKey]
                    .filter((f) => !buckets.some((b) => b.key === f))
                    .map((f) => ({ key: f, doc_count: 0 })),
                ]
              : buckets,
        },
      ]);

    const missingAggregationEntries: AggregationEntry[] = Object.entries(
      filters
    )
      .filter(
        ([aggregationKey, values]) =>
          !(aggregationKey in aggregations) && !isEmpty(values)
      )
      .map(([aggregationKey, values]) => [
        aggregationKey,
        { buckets: values.map((v) => ({ key: v, doc_count: 0 })) },
      ]);

    const combinedAggregations = [
      ...aggregationEntriesWithZeroFilterBuckets,
      ...missingAggregationEntries,
    ];

    return combinedAggregations
      .filter(([, { buckets }]) => buckets.length)
      .sort(([key1], [key2]) => compareAggregationKey(key1, key2));
  }, [aggregations, filters]);

  useEffect(() => {
    if (!isEmpty(aggregations)) {
      setAggregationsPageSize(
        Object.fromEntries(
          Object.keys(aggregations).map((k) =>
            k in aggregationsPageSize ? [k, aggregationsPageSize[k]] : [k, 5]
          )
        )
      );
    }
  }, [aggregations]);

  return (
    <>
      <div className="sidebar-my-data-holder mt-2 mb-3">
        <Button
          className="text-primary cursor-pointer p-0"
          disabled={isEmpty(filters)}
          type="link"
          onClick={() => onClearFilter({})}>
          {t('label.clear-entity', {
            entity: t('label.all'),
          })}
        </Button>
      </div>
      <hr className="m-y-xs" />
      <div
        className="sidebar-my-data-holder mt-2 mb-3"
        data-testid="show-deleted-cntnr">
        <div
          className="filter-group justify-between m-b-xs"
          data-testid="filter-container-deleted">
          <div className="flex">
            <div className="filters-title w-36 truncate custom-checkbox-label">
              {t('label.show-deleted')}
            </div>
          </div>
          <div
            className={classNames(
              'toggle-switch m-r-0',
              showDeleted ? 'open' : null
            )}
            data-testid="show-deleted"
            onClick={() => {
              onChangeShowDeleted(!showDeleted);
            }}>
            <div className="switch" />
          </div>
        </div>
      </div>
      <hr className="m-y-xs" />
      {aggregationEntries.map(
        (
          [aggregationKey, aggregation],
          index,
          { length: aggregationsLength }
        ) => (
          <div data-testid={`filter-heading-${aggregationKey}`} key={index}>
            <div className="d-flex justify-between flex-col">
              <h6 className="font-medium text-grey-body m-b-sm m-y-xs">
                {translateAggregationKeyToTitle(aggregationKey)}
              </h6>
            </div>
            <div
              className="sidebar-my-data-holder"
              data-testid="filter-container">
              {aggregation.buckets
                .slice(0, aggregationsPageSize[aggregationKey])
                .map((bucket, index) => (
                  <FilterContainer
                    count={bucket.doc_count}
                    isSelected={
                      !isNil(filters) && aggregationKey in filters
                        ? filters[aggregationKey].includes(bucket.key)
                        : false
                    }
                    key={index}
                    name={bucket.key}
                    type={aggregationKey}
                    onSelect={onSelectHandler}
                  />
                ))}
              <div className="m-y-sm">
                {aggregationsPageSize[aggregationKey] <
                  aggregation.buckets.length && (
                  <p
                    className="link-text text-xs"
                    onClick={() =>
                      setAggregationsPageSize((prev) => ({
                        ...prev,
                        [aggregationKey]: prev[aggregationKey] + 5,
                      }))
                    }>
                    {t('label.view-entity', {
                      entity: t('label.more-lowercase'),
                    })}
                  </p>
                )}
                {aggregationsPageSize[aggregationKey] > 5 && (
                  <p
                    className="link-text text-xs text-left"
                    onClick={() =>
                      setAggregationsPageSize((prev) => ({
                        ...prev,
                        [aggregationKey]: Math.max(5, prev[aggregationKey] - 5),
                      }))
                    }>
                    {t('label.view-entity', {
                      entity: t('label.less-lowercase'),
                    })}
                  </p>
                )}
              </div>
            </div>
            {index !== aggregationsLength - 1 && <Divider className="m-0" />}
          </div>
        )
      )}
    </>
  );
};

export default FacetFilter;
