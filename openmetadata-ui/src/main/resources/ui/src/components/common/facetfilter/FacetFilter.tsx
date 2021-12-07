/*
 *  Copyright 2021 Collate
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

import { lowerCase } from 'lodash';
import { AggregationType, Bucket, FilterObject } from 'Models';
import PropTypes from 'prop-types';
import React, { Fragment, FunctionComponent, useState } from 'react';
import {
  facetFilterPlaceholder,
  LIST_SIZE,
} from '../../../constants/constants';
import { FacetProp } from './FacetTypes';
import FilterContainer from './FilterContainer';
const FacetFilter: FunctionComponent<FacetProp> = ({
  aggregations,
  onSelectHandler,
  filters,
  onClearFilter,
  onSelectAllFilter,
}: FacetProp) => {
  const [showAllTags, setShowAllTags] = useState<boolean>(false);
  const [showAllServices, setShowAllServices] = useState<boolean>(false);
  const [showAllTier, setShowAllTier] = useState<boolean>(false);
  const [showAllDatabase, setShowAllDatabase] = useState<boolean>(false);
  const getLinkText = (
    length: number,
    state: boolean,
    setState: (value: boolean) => void
  ) => {
    return (
      length > 5 && (
        <p className="link-text tw-text-xs" onClick={() => setState(!state)}>
          {state ? 'View less' : 'View more'}
        </p>
      )
    );
  };
  const getSeparator = (length: number, index: number, flag: boolean) => {
    return length !== 1 && index < length - 1 && flag ? (
      <div className="tw-filter-seperator" />
    ) : null;
  };
  const sortBuckets = (buckets: Array<Bucket>) => {
    return buckets.sort((a, b) => (a.key > b.key ? 1 : -1));
  };
  const getBuckets = (buckets: Array<Bucket>, state: boolean) => {
    return sortBuckets(buckets).slice(0, state ? buckets.length : LIST_SIZE);
  };

  const getLinkTextByTitle = (title: string, bucketLength: number) => {
    switch (title) {
      case 'Service':
        return getLinkText(bucketLength, showAllServices, setShowAllServices);
      case 'Tags':
        return getLinkText(bucketLength, showAllTags, setShowAllTags);
      case 'Tier':
        return getLinkText(bucketLength, showAllTier, setShowAllTier);
      case 'Database':
        return getLinkText(bucketLength, showAllDatabase, setShowAllDatabase);
      default:
        return null;
    }
  };

  const getBucketsByTitle = (title: string, buckets: Array<Bucket>) => {
    switch (title) {
      case 'Service':
        return getBuckets(buckets, showAllServices);
      case 'Tags':
        return getBuckets(buckets, showAllTags);
      case 'Tier':
        return getBuckets(buckets, showAllTier);
      case 'Database':
        return getBuckets(buckets, showAllDatabase);
      default:
        return [];
    }
  };
  const getFilterItems = (aggregation: AggregationType) => {
    return (
      <>
        {getBucketsByTitle(aggregation.title, aggregation.buckets).map(
          (bucket: Bucket, index: number) => (
            <FilterContainer
              count={bucket.doc_count}
              isSelected={filters[
                lowerCase(aggregation.title) as keyof FilterObject
              ].includes(bucket.key)}
              key={index}
              name={bucket.key}
              type={lowerCase(aggregation.title) as keyof FilterObject}
              onSelect={onSelectHandler}
            />
          )
        )}
        {getLinkTextByTitle(aggregation.title, aggregation.buckets.length)}
      </>
    );
  };

  const isClearFilter = (aggregation: AggregationType) => {
    const buckets = getBucketsByTitle(aggregation.title, aggregation.buckets);
    const flag = buckets.some((bucket) =>
      filters[lowerCase(aggregation.title) as keyof FilterObject].includes(
        bucket.key
      )
    );

    return flag;
  };

  const isSelectAllFilter = (aggregation: AggregationType) => {
    const buckets = getBucketsByTitle(aggregation.title, aggregation.buckets);
    const flag = buckets.every((bucket) =>
      filters[lowerCase(aggregation.title) as keyof FilterObject].includes(
        bucket.key
      )
    );

    return !flag;
  };

  return (
    <>
      {aggregations.map((aggregation: AggregationType, index: number) => {
        return (
          <Fragment key={index}>
            {aggregation.buckets.length > 0 ? (
              <>
                <div className="tw-flex tw-justify-between tw-flex-col">
                  <h6
                    className="tw-heading tw-mb-0"
                    data-testid="filter-heading">
                    {
                      facetFilterPlaceholder.find(
                        (filter) => filter.name === aggregation.title
                      )?.value
                    }
                  </h6>
                  <div className="tw-flex tw-mt-1.5">
                    <span
                      className="link-text tw-text-xs"
                      onClick={() => {
                        if (isSelectAllFilter(aggregation)) {
                          onSelectAllFilter(
                            lowerCase(aggregation.title) as keyof FilterObject,
                            aggregation.buckets.map((b) => b.key)
                          );
                        }
                      }}>
                      Select All
                    </span>
                    <span className="tw-text-xs tw-px-2">|</span>
                    <span
                      className="link-text tw-text-xs tw-text-grey-muted"
                      onClick={() => {
                        if (isClearFilter(aggregation)) {
                          onClearFilter(
                            lowerCase(aggregation.title) as keyof FilterObject
                          );
                        }
                      }}>
                      Deselect All
                    </span>
                  </div>
                </div>
                <div className="sidebar-my-data-holder mt-2 mb-3">
                  {getFilterItems(aggregation)}
                </div>
                {getSeparator(
                  aggregations.length,
                  index,
                  aggregations[index + 1]?.buckets?.length > 0
                )}
              </>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
};

FacetFilter.propTypes = {
  aggregations: PropTypes.array.isRequired,
  onSelectHandler: PropTypes.func.isRequired,
  filters: PropTypes.shape({
    tags: PropTypes.array.isRequired,
    service: PropTypes.array.isRequired,
    tier: PropTypes.array.isRequired,
  }).isRequired,
};

export default FacetFilter;
