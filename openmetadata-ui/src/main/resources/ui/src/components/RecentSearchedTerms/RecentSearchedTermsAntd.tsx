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

import { Button, Card } from 'antd';
import { RecentlySearchedData } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getExplorePathWithSearch } from '../../constants/constants';
import {
  getRecentlySearchedData,
  removeRecentSearchTerm,
} from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import PopOver from '../common/popover/PopOver';

const RecentSearchedTermsAntd: FunctionComponent = () => {
  const [recentlySearchedTerms, setRecentlySearchTerms] = useState<
    RecentlySearchedData[]
  >([]);

  const onRemove = (term: string) => {
    removeRecentSearchTerm(term);
    setRecentlySearchTerms(getRecentlySearchedData());
  };

  useEffect(() => {
    setRecentlySearchTerms(getRecentlySearchedData());
  }, []);

  return (
    <>
      <Card
        style={{
          border: '1px rgb(221, 227, 234) solid',
          borderRadius: '8px',
          boxShadow: '1px 1px 6px rgb(0 0 0 / 12%)',
          marginRight: '4px',
          marginLeft: '4px',
        }}
        title="Recent Search Terms">
        {recentlySearchedTerms.length ? (
          recentlySearchedTerms.map((item, index) => {
            return (
              <div
                className="tw-flex tw-items-center tw-justify-between tw-group"
                data-testid={`Recently-Search-${item.term}`}
                key={index}>
                <div className="tw-flex">
                  <SVGIcons
                    alt="search"
                    className="tw-h-4 tw-w-4 tw-self-center"
                    icon={Icons.SEARCHV1}
                  />
                  <div className="tw-flex tw-justify-between">
                    <Link
                      className="tw-font-medium"
                      to={getExplorePathWithSearch(item.term)}>
                      <Button
                        className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline"
                        data-testid={`search-term-${item.term}`}
                        type="text">
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
                      </Button>
                    </Link>
                    <Button
                      className="tw-opacity-0 group-hover:tw-opacity-100 tw-ml-2"
                      type="text"
                      onClick={() => onRemove(item.term)}>
                      <SVGIcons
                        alt="delete"
                        icon="icon-times-circle"
                        width="12"
                      />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <>No searched terms.</>
        )}
      </Card>
    </>
  );
};

export default RecentSearchedTermsAntd;
