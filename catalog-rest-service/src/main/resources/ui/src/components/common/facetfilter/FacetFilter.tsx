/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
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
}: FacetProp) => {
  const [showAllTags, setShowAllTags] = useState<boolean>(false);
  const [showAllServices, setShowAllServices] = useState<boolean>(false);
  const [showAllClusters, setShowAllClusters] = useState<boolean>(false);
  const [showAllTier, setShowAllTier] = useState<boolean>(false);
  const sortAggregations = () => {
    return aggregations.sort((a, b) =>
      a.buckets.length > b.buckets.length ? 1 : -1
    );
  };
  const getLinkText = (
    length: number,
    state: boolean,
    setState: (value: boolean) => void
  ) => {
    return (
      length > 5 && (
        <p className="link-text" onClick={() => setState(!state)}>
          {state ? 'View less' : 'View more'}
        </p>
      )
    );
  };
  const getSeparator = (length: number, index: number) => {
    return length !== 1 && index < length - 1 ? (
      <div className="seperator tw-mb-4 tw--mx-4 " />
    ) : null;
  };
  const sortBuckets = (buckets: Array<Bucket>) => {
    return buckets.sort((a, b) => (a.key > b.key ? 1 : -1));
  };
  const getBuckets = (buckets: Array<Bucket>, state: boolean) => {
    return sortBuckets(buckets).slice(
      0,
      state ? buckets.length - 1 : LIST_SIZE
    );
  };

  const getLinkTextByTitle = (title: string, bucketLength: number) => {
    switch (title) {
      case 'Service':
        return getLinkText(bucketLength, showAllServices, setShowAllServices);
      case 'Tags':
        return getLinkText(bucketLength, showAllTags, setShowAllTags);
      case 'Service Type':
        return getLinkText(bucketLength, showAllClusters, setShowAllClusters);
      case 'Tier':
        return getLinkText(bucketLength, showAllTier, setShowAllTier);
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
      case 'Service Type':
        return getBuckets(buckets, showAllClusters);
      case 'Tier':
        return getBuckets(buckets, showAllTier);
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
              isDisabled={aggregation.buckets.length === 1}
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

  return (
    <>
      {sortAggregations().map((aggregation: AggregationType, index: number) => {
        return (
          <Fragment key={index}>
            {aggregation.buckets.length > 0 ? (
              <>
                <div className="tw-flex tw-justify-between">
                  <h6 className="tw-heading">
                    {
                      facetFilterPlaceholder.find(
                        (filter) => filter.name === aggregation.title
                      )?.value
                    }
                  </h6>
                  {isClearFilter(aggregation) && (
                    <p
                      className="link-text"
                      onClick={() =>
                        onClearFilter(
                          lowerCase(aggregation.title) as keyof FilterObject
                        )
                      }>
                      Clear filter
                    </p>
                  )}
                </div>
                <div className="sidebar-my-data-holder mt-2 mb-3">
                  {getFilterItems(aggregation)}
                </div>
                {getSeparator(aggregations.length, index)}
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
    'service type': PropTypes.array.isRequired,
    tier: PropTypes.array.isRequired,
  }).isRequired,
};

export default FacetFilter;
