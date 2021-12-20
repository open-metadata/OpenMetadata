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

import React, { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { getExplorePathWithSearch } from '../../constants/constants';
import { getRecentlySearchedData } from '../../utils/CommonUtils';
import PopOver from '../common/popover/PopOver';

const RecentSearchedTerms: FunctionComponent = () => {
  const recentlySearchedTerms = getRecentlySearchedData();

  return (
    <>
      <h6 className="tw-heading tw-mb-3" data-testid="filter-heading">
        Recent Search Terms
      </h6>
      {recentlySearchedTerms.length ? (
        recentlySearchedTerms.map((item, index) => {
          return (
            <div
              className="tw-flex tw-items-center tw-justify-between tw-mb-2"
              data-testid={`Recently-Search-${item.term}`}
              key={index}>
              <div className="tw-flex">
                <i className="fa fa-search tw-text-grey-muted tw-pr-2 tw-self-center" />
                <Link
                  className="tw-font-medium"
                  to={getExplorePathWithSearch(item.term)}>
                  <button className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline">
                    {item.term.length > 20 ? (
                      <PopOver
                        html={
                          <div className="tw-flex tw-flex-nowrap">
                            {item.term}
                          </div>
                        }
                        position="top"
                        size="regular"
                        trigger="mouseenter">
                        <span>{item.term.slice(0, 20)}...</span>
                      </PopOver>
                    ) : (
                      item.term
                    )}
                  </button>
                </Link>
              </div>
            </div>
          );
        })
      ) : (
        <>No searched terms!</>
      )}
    </>
  );
};

export default RecentSearchedTerms;
