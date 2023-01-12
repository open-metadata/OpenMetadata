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

import { Button, Card, Popover } from 'antd';
import { RecentlySearchedData } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getExplorePathWithSearch } from '../../constants/constants';
import {
  getRecentlySearchedData,
  removeRecentSearchTerm,
} from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

import { leftPanelAntCardStyle } from '../containers/PageLayout';
import EntityListSkeleton from '../Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import { DEFAULT_SKELETON_DATA_LENGTH } from '../Skeleton/SkeletonUtils/Skeleton.utils';

const RecentSearchedTermsAntd: FunctionComponent = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [recentlySearchedTerms, setRecentlySearchTerms] = useState<
    RecentlySearchedData[]
  >([]);

  const onRemove = (term: string) => {
    removeRecentSearchTerm(term);
    setRecentlySearchTerms(getRecentlySearchedData());
  };

  useEffect(() => {
    setLoading(true);
    setRecentlySearchTerms(getRecentlySearchedData());
    setLoading(false);
  }, []);

  return (
    <>
      <Card
        style={leftPanelAntCardStyle}
        title={t('label.recent-search-term-plural')}>
        <EntityListSkeleton
          dataLength={
            recentlySearchedTerms.length !== 0
              ? recentlySearchedTerms.length
              : DEFAULT_SKELETON_DATA_LENGTH
          }
          loading={loading}>
          <>
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
                              <Popover
                                content={
                                  <div className="tw-flex tw-flex-nowrap">
                                    {item.term}
                                  </div>
                                }
                                placement="top"
                                trigger="hover">
                                <span>{item.term.slice(0, 20)}...</span>
                              </Popover>
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
              <>{t('message.no-searched-terms')}.</>
            )}
          </>
        </EntityListSkeleton>
      </Card>
    </>
  );
};

export default RecentSearchedTermsAntd;
