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
import { Button, Card, Tabs } from 'antd';
import unique from 'fork-ts-checker-webpack-plugin/lib/utils/array/unique';
import { isNil, isNumber, lowerCase, noop, omit, toUpper } from 'lodash';
import { EntityType } from 'Models';
import React, { Fragment, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import FacetFilter from '../../components/common/facetfilter/FacetFilter';
import SearchedData from '../../components/searched-data/SearchedData';
import { ENTITY_PATH } from '../../constants/constants';
import { tabsInfo } from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import { getCountBadge } from '../../utils/CommonUtils';
import { FacetFilterProps } from '../common/facetfilter/facetFilter.interface';
import PageLayout, { leftPanelAntCardStyle } from '../containers/PageLayout';
import Loader from '../Loader/Loader';
import { AdvancedSearchModal } from './AdvanceSearchModal.component';
import {
  ExploreProps,
  ExploreQuickFilterField,
  ExploreSearchIndex,
  ExploreSearchIndexKey,
} from './explore.interface';
import AdvancedFields from './ExploreQuickFilters';
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
  const { tab } = useParams<{ tab: string }>();
  const [showAdvanceSearchModal, setShowAdvanceSearchModal] = useState(false);

  const [selectedQuickFilters, setSelectedQuickFilters] = useState<
    ExploreQuickFilterField[]
  >([] as ExploreQuickFilterField[]);

  // get entity active tab by URL params
  const defaultActiveTab = useMemo(() => {
    const entityName = toUpper(ENTITY_PATH[tab as EntityType] ?? 'table');

    return SearchIndex[entityName as ExploreSearchIndexKey];
  }, [tab]);

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

  const handleAdvanceFieldClear = () => {
    setSelectedQuickFilters([]);
  };

  const handleAdvanceFieldRemove = (value: string) => {
    setSelectedQuickFilters((prev) => prev.filter((p) => p.key !== value));
  };

  const handleAdvanceFieldValueSelect = (field: ExploreQuickFilterField) => {
    setSelectedQuickFilters((pre) => {
      return pre.map((preField) => {
        if (preField.key === field.key) {
          return field;
        } else {
          return preField;
        }
      });
    });
  };

  const handleAdvancedFieldSelect = (value: string) => {
    const flag = selectedQuickFilters.some((field) => field.key === value);
    if (!flag) {
      setSelectedQuickFilters((pre) => [
        ...pre,
        { key: value, value: undefined },
      ]);
    }
  };

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
          defaultActiveKey={defaultActiveTab}
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
              <Button
                ghost
                type="primary"
                onClick={() => setShowAdvanceSearchModal(true)}>
                Advance Search
              </Button>
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

        <AdvancedFields
          fields={selectedQuickFilters}
          index={searchIndex}
          onClear={handleAdvanceFieldClear}
          onFieldRemove={handleAdvanceFieldRemove}
          onFieldSelect={handleAdvancedFieldSelect}
          onFieldValueSelect={handleAdvanceFieldValueSelect}
        />
        <AdvancedSearchModal
          jsonTree={advancedSearchJsonTree}
          searchIndex={searchIndex}
          visible={showAdvanceSearchModal}
          onCancel={() => setShowAdvanceSearchModal(false)}
          onChangeJsonTree={onChangeAdvancedSearchJsonTree}
          onSubmit={onChangeAdvancedSearchQueryFilter}
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
