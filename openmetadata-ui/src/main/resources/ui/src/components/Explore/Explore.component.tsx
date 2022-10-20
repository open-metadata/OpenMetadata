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

import {
  faSortAmountDownAlt,
  faSortAmountUpAlt,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Card, Tabs } from 'antd';
import unique from 'fork-ts-checker-webpack-plugin/lib/utils/array/unique';
import { isNil, isNumber, lowerCase, noop, omit } from 'lodash';
import React, { Fragment, useEffect, useRef } from 'react';
import FacetFilter from '../../components/common/facetfilter/FacetFilter';
import SearchedData from '../../components/searched-data/SearchedData';
import { tabsInfo } from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import { getCountBadge } from '../../utils/CommonUtils';
import AdvancedSearch from '../AdvancedSearch/AdvancedSearch.component';
import { FacetFilterProps } from '../common/facetfilter/facetFilter.interface';
import PageLayout, { leftPanelAntCardStyle } from '../containers/PageLayout';
import Loader from '../Loader/Loader';
import { ExploreProps, ExploreSearchIndex } from './explore.interface';
import SortingDropDown from './SortingDropDown';

const Explore: React.FC<ExploreProps> = ({
  searchResults,
  tabCounts,
  advancedSearchJsonTree,
  onChangeAdvancedSearchJsonTree,
  onChangeAdvancedSearchQueryFilter,
  postFilter,
  onChangePostFilter,
  searchIndex,
  onChangeSearchIndex,
  sortOrder,
  onChangeSortOder,
  sortValue,
  onChangeSortValue,
  onChangeShowDeleted,
  showDeleted,
  page = 1,
  onChangePage = noop,
  loading,
}) => {
  const isMounting = useRef(true);

  const handleFacetFilterChange: FacetFilterProps['onSelectHandler'] = (
    checked,
    value,
    key
  ) => {
    const currKeyFilters =
      isNil(postFilter) || !(key in postFilter)
        ? ([] as string[])
        : postFilter[key];
    if (checked) {
      onChangePostFilter({
        ...postFilter,
        [key]: unique([...currKeyFilters, value]),
      });
    } else {
      const filteredKeyFilters = currKeyFilters.filter((v) => v !== value);
      if (filteredKeyFilters.length) {
        onChangePostFilter({
          ...postFilter,
          [key]: filteredKeyFilters,
        });
      } else {
        onChangePostFilter(omit(postFilter, key));
      }
    }
  };

  const handleFacetFilterClearFilter: FacetFilterProps['onClearFilter'] = (
    key
  ) => onChangePostFilter(omit(postFilter, key));

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  return (
    <Fragment>
      <PageLayout
        leftPanel={
          <div className="tw-h-full">
            <Card
              data-testid="data-summary-container"
              style={{ ...leftPanelAntCardStyle, marginTop: '16px' }}>
              <FacetFilter
                aggregations={searchResults?.aggregations}
                filters={postFilter}
                showDeleted={showDeleted}
                onChangeShowDeleted={onChangeShowDeleted}
                onClearFilter={handleFacetFilterClearFilter}
                onSelectHandler={handleFacetFilterChange}
              />
            </Card>
          </div>
        }>
        <Tabs
          defaultActiveKey={lowerCase(tabsInfo[SearchIndex.TABLE].label)}
          size="small"
          tabBarExtraContent={
            <div className="tw-flex">
              <SortingDropDown
                fieldList={tabsInfo[searchIndex].sortingFields}
                handleFieldDropDown={onChangeSortValue}
                sortField={sortValue}
              />

              <div className="tw-flex">
                {sortOrder === 'asc' ? (
                  <button
                    className="tw-mt-2"
                    onClick={() => onChangeSortOder('desc')}>
                    <FontAwesomeIcon
                      className="tw-text-base tw-text-primary"
                      data-testid="last-updated"
                      icon={faSortAmountUpAlt}
                    />
                  </button>
                ) : (
                  <button
                    className="tw-mt-2"
                    onClick={() => onChangeSortOder('asc')}>
                    <FontAwesomeIcon
                      className="tw-text-base tw-text-primary"
                      data-testid="last-updated"
                      icon={faSortAmountDownAlt}
                    />
                  </button>
                )}
              </div>
            </div>
          }
          onChange={(tab) => {
            tab && onChangeSearchIndex(tab as ExploreSearchIndex);
          }}>
          {Object.entries(tabsInfo).map(([tabSearchIndex, tabDetail]) => (
            <Tabs.TabPane
              key={tabSearchIndex}
              tab={
                <div data-testid={`${lowerCase(tabDetail.label)}-tab`}>
                  {tabDetail.label}
                  <span className="p-l-xs ">
                    {!isNil(tabCounts)
                      ? getCountBadge(
                          tabCounts[tabSearchIndex as ExploreSearchIndex],
                          '',
                          tabSearchIndex === searchIndex
                        )
                      : getCountBadge()}
                  </span>
                </div>
              }
            />
          ))}
        </Tabs>
        <AdvancedSearch
          jsonTree={advancedSearchJsonTree}
          searchIndex={searchIndex}
          onChangeJsonTree={(nTree) => onChangeAdvancedSearchJsonTree(nTree)}
          onChangeQueryFilter={(nQueryFilter) =>
            onChangeAdvancedSearchQueryFilter(nQueryFilter)
          }
        />
        {!loading ? (
          <SearchedData
            isFilterSelected
            showResultCount
            currentPage={page}
            data={searchResults?.hits.hits ?? []}
            paginate={(value) => {
              if (isNumber(value)) {
                onChangePage(value);
              } else if (!isNaN(Number.parseInt(value))) {
                onChangePage(Number.parseInt(value));
              }
            }}
            totalValue={searchResults?.hits.total.value ?? 0}
          />
        ) : (
          <Loader />
        )}
      </PageLayout>
    </Fragment>
  );
};

export default Explore;
