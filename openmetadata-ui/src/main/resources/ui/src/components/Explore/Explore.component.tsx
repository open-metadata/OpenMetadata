/*
 *  Copyright 2023 Collate.
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
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Tabs } from 'antd';
import FacetFilter from 'components/common/facetfilter/FacetFilter';
import SearchedData from 'components/searched-data/SearchedData';
import { SORT_ORDER } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import unique from 'fork-ts-checker-webpack-plugin/lib/utils/array/unique';
import {
  isEmpty,
  isNil,
  isNumber,
  isUndefined,
  lowerCase,
  noop,
  omit,
  toUpper,
} from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ENTITY_PATH } from '../../constants/constants';
import { tabsInfo } from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import {
  QueryFieldInterface,
  QueryFieldValueInterface,
} from '../../pages/explore/ExplorePage.interface';
import { getDropDownItems } from '../../utils/AdvancedSearchUtils';
import { getCountBadge } from '../../utils/CommonUtils';
import { FacetFilterProps } from '../common/facetfilter/facetFilter.interface';
import PageLayoutV1 from '../containers/PageLayoutV1';
import Loader from '../Loader/Loader';
import ExploreSkeleton from '../Skeleton/Explore/ExploreLeftPanelSkeleton.component';
import { useAdvanceSearch } from './AdvanceSearchProvider/AdvanceSearchProvider.component';
import AppliedFilterText from './AppliedFilterText/AppliedFilterText';
import EntitySummaryPanel from './EntitySummaryPanel/EntitySummaryPanel.component';
import {
  EntityDetailsObjectInterface,
  EntityUnion,
  ExploreProps,
  ExploreQuickFilterField,
  ExploreSearchIndex,
  ExploreSearchIndexKey,
} from './explore.interface';
import './Explore.style.less';
import { getSelectedValuesFromQuickFilter } from './Explore.utils';
import ExploreQuickFilters from './ExploreQuickFilters';
import SortingDropDown from './SortingDropDown';

const Explore: React.FC<ExploreProps> = ({
  aggregations,
  searchResults,
  tabCounts,
  onChangeAdvancedSearchQuickFilters,
  facetFilters,
  onChangeFacetFilters,
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
  quickFilters,
}) => {
  const { t } = useTranslation();
  const { tab } = useParams<{ tab: string }>();

  const [selectedQuickFilters, setSelectedQuickFilters] = useState<
    ExploreQuickFilterField[]
  >([] as ExploreQuickFilterField[]);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [entityDetails, setEntityDetails] =
    useState<{ details: EntityUnion; entityType: string }>();

  const { toggleModal, sqlQuery } = useAdvanceSearch();

  const handleClosePanel = () => {
    setShowSummaryPanel(false);
  };

  const isAscSortOrder = useMemo(
    () => sortOrder === SORT_ORDER.ASC,
    [sortOrder]
  );
  const sortProps = useMemo(
    () => ({
      className: 'text-base text-primary',
      'data-testid': 'last-updated',
    }),
    []
  );

  const tabItems = useMemo(
    () =>
      Object.entries(tabsInfo).map(([tabSearchIndex, tabDetail]) => ({
        key: tabSearchIndex,
        label: (
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
        ),
      })),
    [tabsInfo, tabCounts]
  );

  // get entity active tab by URL params
  const defaultActiveTab = useMemo(() => {
    const entityName = toUpper(ENTITY_PATH[tab] ?? 'table');

    return SearchIndex[entityName as ExploreSearchIndexKey];
  }, [tab]);

  const handleFacetFilterChange: FacetFilterProps['onSelectHandler'] = (
    checked,
    value,
    key
  ) => {
    const currKeyFilters =
      isNil(facetFilters) || !(key in facetFilters)
        ? ([] as string[])
        : facetFilters[key];
    if (checked) {
      onChangeFacetFilters({
        ...facetFilters,
        [key]: unique([...currKeyFilters, value]),
      });
    } else {
      const filteredKeyFilters = currKeyFilters.filter((v) => v !== value);
      if (filteredKeyFilters.length) {
        onChangeFacetFilters({
          ...facetFilters,
          [key]: filteredKeyFilters,
        });
      } else {
        onChangeFacetFilters(omit(facetFilters, key));
      }
    }
  };

  const handleSummaryPanelDisplay = useCallback(
    (details: EntityUnion, entityType: string) => {
      setShowSummaryPanel(true);
      setEntityDetails({ details, entityType });
    },
    []
  );

  const handleQuickFiltersChange = (data: ExploreQuickFilterField[]) => {
    const must = [] as Array<QueryFieldInterface>;

    // Mapping the selected advanced search quick filter dropdown values
    // to form a queryFilter to pass as a search parameter
    data.forEach((filter) => {
      if (!isEmpty(filter.value)) {
        const should = [] as Array<QueryFieldValueInterface>;
        if (filter.value) {
          filter.value.forEach((filterValue) => {
            const term = {} as QueryFieldValueInterface['term'];

            term[filter.key] = filterValue.key;

            should.push({ term });
          });
        }

        must.push({ bool: { should } });
      }
    });

    onChangeAdvancedSearchQuickFilters(
      isEmpty(must)
        ? undefined
        : {
            query: { bool: { must } },
          }
    );
  };

  const handleQuickFiltersValueSelect = (field: ExploreQuickFilterField) => {
    setSelectedQuickFilters((pre) => {
      const data = pre.map((preField) => {
        if (preField.key === field.key) {
          return field;
        } else {
          return preField;
        }
      });

      handleQuickFiltersChange(data);

      return data;
    });
  };

  const showFilters = useMemo(() => {
    return entityDetails?.entityType !== EntityType.TAG ?? true;
  }, [entityDetails]);

  useEffect(() => {
    const escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClosePanel();
      }
    };
    document.addEventListener('keydown', escapeKeyHandler);

    return () => {
      document.removeEventListener('keydown', escapeKeyHandler);
    };
  }, []);

  useEffect(() => {
    const dropdownItems = getDropDownItems(searchIndex);

    setSelectedQuickFilters(
      dropdownItems.map((item) => ({
        ...item,
        value: getSelectedValuesFromQuickFilter(
          item,
          dropdownItems,
          quickFilters
        ),
      }))
    );
  }, [searchIndex, quickFilters]);

  useEffect(() => {
    if (
      !isUndefined(searchResults) &&
      searchResults?.hits?.hits[0] &&
      searchResults?.hits?.hits[0]._index === searchIndex
    ) {
      handleSummaryPanelDisplay(
        searchResults?.hits?.hits[0]._source as EntityUnion,
        tab
      );
    } else {
      setShowSummaryPanel(false);
      setEntityDetails(undefined);
    }
  }, [tab, searchResults]);

  return (
    <PageLayoutV1
      className="explore-page-container"
      leftPanel={
        <Card
          className="page-layout-v1-left-panel page-layout-v1-vertical-scroll"
          data-testid="data-summary-container">
          <ExploreSkeleton loading={Boolean(loading)}>
            <FacetFilter
              aggregations={omit(aggregations, 'entityType')}
              filters={facetFilters}
              showDeleted={showDeleted}
              onChangeShowDeleted={onChangeShowDeleted}
              onClearFilter={onChangeFacetFilters}
              onSelectHandler={handleFacetFilterChange}
            />
          </ExploreSkeleton>
        </Card>
      }
      pageTitle={t('label.explore')}>
      <Tabs
        activeKey={searchIndex}
        defaultActiveKey={defaultActiveTab}
        items={tabItems}
        size="small"
        tabBarExtraContent={
          <Space align="center" size={4}>
            <SortingDropDown
              fieldList={tabsInfo[searchIndex].sortingFields}
              handleFieldDropDown={onChangeSortValue}
              sortField={sortValue}
            />
            <Button
              className="p-0"
              size="small"
              type="text"
              onClick={() =>
                onChangeSortOder(
                  isAscSortOrder ? SORT_ORDER.DESC : SORT_ORDER.ASC
                )
              }>
              {isAscSortOrder ? (
                <SortAscendingOutlined {...sortProps} />
              ) : (
                <SortDescendingOutlined {...sortProps} />
              )}
            </Button>
          </Space>
        }
        onChange={(tab) => {
          tab && onChangeSearchIndex(tab as ExploreSearchIndex);
          setShowSummaryPanel(false);
        }}
      />

      <Row gutter={[8, 0]} wrap={false}>
        <Col className="searched-data-container" flex="auto">
          <Row gutter={[16, 16]}>
            {showFilters && (
              <Col span={24}>
                <ExploreQuickFilters
                  fields={selectedQuickFilters}
                  index={searchIndex}
                  onAdvanceSearch={() => toggleModal(true)}
                  onFieldValueSelect={handleQuickFiltersValueSelect}
                />
              </Col>
            )}

            {sqlQuery && (
              <Col span={24}>
                <AppliedFilterText
                  filterText={sqlQuery}
                  onEdit={() => toggleModal(true)}
                />
              </Col>
            )}

            <Col span={24}>
              {!loading ? (
                <SearchedData
                  isFilterSelected
                  showResultCount
                  currentPage={page}
                  data={searchResults?.hits.hits ?? []}
                  handleSummaryPanelDisplay={handleSummaryPanelDisplay}
                  isSummaryPanelVisible={showSummaryPanel}
                  paginate={(value) => {
                    if (isNumber(value)) {
                      onChangePage(value);
                    } else if (!isNaN(Number.parseInt(value))) {
                      onChangePage(Number.parseInt(value));
                    }
                  }}
                  selectedEntityId={entityDetails?.details.id || ''}
                  totalValue={searchResults?.hits.total.value ?? 0}
                />
              ) : (
                <Loader />
              )}
            </Col>
          </Row>
        </Col>
        {showSummaryPanel && (
          <Col flex="400px">
            <EntitySummaryPanel
              entityDetails={
                entityDetails || ({} as EntityDetailsObjectInterface)
              }
              handleClosePanel={handleClosePanel}
            />
          </Col>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default Explore;
