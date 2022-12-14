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
import { Card, Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import unique from 'fork-ts-checker-webpack-plugin/lib/utils/array/unique';
import {
  isEmpty,
  isNil,
  isNumber,
  lowerCase,
  noop,
  omit,
  toLower,
  toUpper,
} from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getTableDetailsByFQN } from '../../axiosAPIs/tableAPI';
import { getListTestCase } from '../../axiosAPIs/testAPI';
import FacetFilter from '../../components/common/facetfilter/FacetFilter';
import SearchedData from '../../components/searched-data/SearchedData';
import { API_RES_MAX_SIZE, ENTITY_PATH } from '../../constants/constants';
import { tabsInfo } from '../../constants/explore.constants';
import { INITIAL_TEST_RESULT_SUMMARY } from '../../constants/profiler.constant';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Table } from '../../generated/entity/data/table';
import { Include } from '../../generated/type/include';
import { getDropDownItems } from '../../utils/AdvancedSearchUtils';
import {
  formatNumberWithComma,
  formTwoDigitNmber,
  getCountBadge,
} from '../../utils/CommonUtils';
import { updateTestResults } from '../../utils/DataQualityAndProfilerUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { FacetFilterProps } from '../common/facetfilter/facetFilter.interface';
import PageLayoutV1 from '../containers/PageLayoutV1';
import Loader from '../Loader/Loader';
import {
  OverallTableSummeryType,
  TableTestsType,
} from '../TableProfiler/TableProfiler.interface';
import { AdvancedSearchModal } from './AdvanceSearchModal.component';
import EntitySummaryPanel from './EntitySummaryPanel/EntitySummaryPanel.component';
import {
  ExploreProps,
  ExploreQuickFilterField,
  ExploreSearchIndex,
  ExploreSearchIndexKey,
} from './explore.interface';
import ExploreQuickFilters from './ExploreQuickFilters';
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
  const { t } = useTranslation();
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [entityDetails, setEntityDetails] = useState<Table>();
  const [tableTests, setTableTests] = useState<TableTestsType>({
    tests: [],
    results: INITIAL_TEST_RESULT_SUMMARY,
  });

  const handleClosePanel = () => {
    setShowSummaryPanel(false);
  };

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

  const overallSummery: OverallTableSummeryType[] = useMemo(() => {
    return [
      {
        title: 'Row Count',
        value: formatNumberWithComma(entityDetails?.profile?.rowCount ?? 0),
      },
      {
        title: 'Column Count',
        value: entityDetails?.profile?.columnCount ?? 0,
      },
      {
        title: 'Table Sample %',
        value: `${entityDetails?.profile?.profileSample ?? 100}%`,
      },
      {
        title: 'Tests Passed',
        value: formTwoDigitNmber(tableTests.results.success),
        className: 'success',
      },
      {
        title: 'Tests Aborted',
        value: formTwoDigitNmber(tableTests.results.aborted),
        className: 'aborted',
      },
      {
        title: 'Tests Failed',
        value: formTwoDigitNmber(tableTests.results.failed),
        className: 'failed',
      },
    ];
  }, [entityDetails, tableTests]);

  const fetchProfilerData = async (source: Table) => {
    try {
      const res = await getTableDetailsByFQN(
        encodeURIComponent(source?.fullyQualifiedName || ''),
        `${TabSpecificField.TABLE_PROFILE},${TabSpecificField.TABLE_QUERIES}`
      );
      const { profile, tableQueries } = res;
      setEntityDetails((prev) => {
        if (prev) {
          return { ...prev, profile, tableQueries };
        } else {
          return {} as Table;
        }
      });
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', {
          entity: `profile details for table ${source?.name || ''}`,
        })
      );
    }
  };

  const fetchAllTests = async (source: Table) => {
    try {
      const { data } = await getListTestCase({
        fields: 'testCaseResult,entityLink,testDefinition,testSuite',
        entityLink: generateEntityLink(source?.fullyQualifiedName || ''),
        includeAllTests: true,
        limit: API_RES_MAX_SIZE,
        include: Include.Deleted,
      });
      const tableTests: TableTestsType = {
        tests: [],
        results: { ...INITIAL_TEST_RESULT_SUMMARY },
      };
      data.forEach((test) => {
        if (test.entityFQN === source?.fullyQualifiedName) {
          tableTests.tests.push(test);

          updateTestResults(
            tableTests.results,
            test.testCaseResult?.testCaseStatus || ''
          );

          return;
        }
      });
      setTableTests(tableTests);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleSummaryPanelDisplay = (source: Table) => {
    setShowSummaryPanel(true);
    fetchAllTests(source);
    fetchProfilerData(source);
    setEntityDetails(source);
  };

  const handleAdvanceSearchFilter = (data: ExploreQuickFilterField[]) => {
    const terms = [] as Array<Record<string, unknown>>;

    data.forEach((filter) => {
      filter.value?.map((val) => {
        if (filter.key) {
          terms.push({ term: { [filter.key]: val } });
        }
      });
    });

    onChangeAdvancedSearchQueryFilter(
      isEmpty(terms)
        ? undefined
        : {
            query: { bool: { must: terms } },
          }
    );
  };

  const handleAdvanceFieldValueSelect = (field: ExploreQuickFilterField) => {
    setSelectedQuickFilters((pre) => {
      const data = pre.map((preField) => {
        if (preField.key === field.key) {
          return field;
        } else {
          return preField;
        }
      });

      handleAdvanceSearchFilter(data);

      return data;
    });
  };

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
      dropdownItems.map((item) => ({ ...item, value: undefined }))
    );
  }, [searchIndex]);

  return (
    <PageLayoutV1
      leftPanel={
        <Card
          className="page-layout-v1-left-panel page-layout-v1-vertical-scroll"
          data-testid="data-summary-container">
          <FacetFilter
            aggregations={omit(searchResults?.aggregations, 'entityType')}
            filters={postFilter}
            showDeleted={showDeleted}
            onChangeShowDeleted={onChangeShowDeleted}
            onClearFilter={onChangePostFilter}
            onSelectHandler={handleFacetFilterChange}
          />
        </Card>
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
          </div>
        }
        onChange={(tab) => {
          tab && onChangeSearchIndex(tab as ExploreSearchIndex);
          setShowSummaryPanel(false);
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

      <div
        style={{
          marginRight: showSummaryPanel ? '390px' : '',
        }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <ExploreQuickFilters
              fields={selectedQuickFilters}
              index={searchIndex}
              onAdvanceSearch={() => setShowAdvanceSearchModal(true)}
              onFieldValueSelect={handleAdvanceFieldValueSelect}
            />
          </Col>
          <Col span={24}>
            {!loading ? (
              <SearchedData
                isFilterSelected
                showResultCount
                currentPage={page}
                data={searchResults?.hits.hits ?? []}
                handleSummaryPanelDisplay={
                  tab === toLower(EntityType.TABLE)
                    ? handleSummaryPanelDisplay
                    : undefined
                }
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
          </Col>
        </Row>
      </div>
      {tab === toLower(EntityType.TABLE) && (
        <EntitySummaryPanel
          entityDetails={entityDetails || ({} as Table)}
          handleClosePanel={handleClosePanel}
          overallSummery={overallSummery}
          showPanel={showSummaryPanel}
        />
      )}
      <AdvancedSearchModal
        jsonTree={advancedSearchJsonTree}
        searchIndex={searchIndex}
        visible={showAdvanceSearchModal}
        onCancel={() => setShowAdvanceSearchModal(false)}
        onChangeJsonTree={onChangeAdvancedSearchJsonTree}
        onSubmit={onChangeAdvancedSearchQueryFilter}
      />
    </PageLayoutV1>
  );
};

export default Explore;
