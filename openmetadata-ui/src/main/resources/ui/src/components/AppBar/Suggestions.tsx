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

import { Button, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isString } from 'lodash';
import Qs from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import IconSuggestionsBlue from '../../assets/svg/ic-suggestions-blue.svg?react';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import {
  APICollectionSource,
  APIEndpointSource,
  ChartSource,
  DashboardSource,
  DatabaseSchemaSource,
  DatabaseSource,
  DataProductSource,
  GlossarySource,
  MetricSource,
  MlModelSource,
  Option,
  PipelineSource,
  SearchIndexSource,
  SearchSuggestions,
  TableSource,
  TagSource,
  TopicSource,
} from '../../context/GlobalSearchProvider/GlobalSearchSuggestions/GlobalSearchSuggestions.interface';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { SearchIndex } from '../../enums/search.enum';
import {
  ContainerSearchSource,
  DashboardDataModelSearchSource,
  StoredProcedureSearchSource,
} from '../../interface/search.interface';
import { searchQuery } from '../../rest/searchAPI';
import { Transi18next } from '../../utils/CommonUtils';
import searchClassBase from '../../utils/SearchClassBase';
import {
  filterOptionsByIndex,
  getGroupLabel,
  getSuggestionElement,
} from '../../utils/SearchUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';

type SuggestionProp = {
  searchText: string;
  searchCriteria?: SearchIndex;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  isNLPActive?: boolean;
  onSearchTextUpdate?: (text: string) => void;
};

const Suggestions = ({
  searchText,
  setIsOpen,
  searchCriteria,
  isNLPActive = false,
  onSearchTextUpdate,
}: SuggestionProp) => {
  const { t } = useTranslation();
  const { isTourOpen } = useTourProvider();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [options, setOptions] = useState<Array<Option>>([]);
  const [tableSuggestions, setTableSuggestions] = useState<TableSource[]>([]);
  const [topicSuggestions, setTopicSuggestions] = useState<TopicSource[]>([]);
  const [dashboardSuggestions, setDashboardSuggestions] = useState<
    DashboardSource[]
  >([]);

  const [pipelineSuggestions, setPipelineSuggestions] = useState<
    PipelineSource[]
  >([]);
  const [mlModelSuggestions, setMlModelSuggestions] = useState<MlModelSource[]>(
    []
  );
  const [containerSuggestions, setContainerSuggestions] = useState<
    ContainerSearchSource[]
  >([]);
  const [glossaryTermSuggestions, setGlossaryTermSuggestions] = useState<
    GlossarySource[]
  >([]);
  const [databaseSuggestions, setDatabaseSuggestions] = useState<
    DatabaseSource[]
  >([]);
  const [databaseSchemaSuggestions, setDatabaseSchemaSuggestions] = useState<
    DatabaseSchemaSource[]
  >([]);
  const [searchIndexSuggestions, setSearchIndexSuggestions] = useState<
    SearchIndexSource[]
  >([]);
  const [tagSuggestions, setTagSuggestions] = useState<TagSource[]>([]);

  const [storedProcedureSuggestions, setStoredProcedureSuggestions] = useState<
    StoredProcedureSearchSource[]
  >([]);

  const [dataModelSuggestions, setDataModelSuggestions] = useState<
    DashboardDataModelSearchSource[]
  >([]);
  const [dataProductSuggestions, setDataProductSuggestions] = useState<
    DataProductSource[]
  >([]);

  const [chartSuggestions, setChartSuggestions] = useState<ChartSource[]>([]);

  const [apiCollectionSuggestions, setApiCollectionSuggestions] = useState<
    APICollectionSource[]
  >([]);

  const [apiEndpointSuggestions, setApiEndpointSuggestions] = useState<
    APIEndpointSource[]
  >([]);
  const [metricSuggestions, setMetricSuggestions] = useState<MetricSource[]>(
    []
  );

  const isMounting = useRef(true);

  const updateSuggestions = (options: Array<Option>) => {
    setTableSuggestions(filterOptionsByIndex(options, SearchIndex.TABLE));
    setTopicSuggestions(filterOptionsByIndex(options, SearchIndex.TOPIC));
    setDashboardSuggestions(
      filterOptionsByIndex(options, SearchIndex.DASHBOARD)
    );
    setPipelineSuggestions(filterOptionsByIndex(options, SearchIndex.PIPELINE));
    setMlModelSuggestions(filterOptionsByIndex(options, SearchIndex.MLMODEL));
    setContainerSuggestions(
      filterOptionsByIndex(options, SearchIndex.CONTAINER)
    );
    setSearchIndexSuggestions(
      filterOptionsByIndex(options, SearchIndex.SEARCH_INDEX)
    );
    setStoredProcedureSuggestions(
      filterOptionsByIndex(options, SearchIndex.STORED_PROCEDURE)
    );
    setDataModelSuggestions(
      filterOptionsByIndex(options, SearchIndex.DASHBOARD_DATA_MODEL)
    );
    setGlossaryTermSuggestions(
      filterOptionsByIndex(options, SearchIndex.GLOSSARY_TERM)
    );
    setTagSuggestions(filterOptionsByIndex(options, SearchIndex.TAG));
    setDataProductSuggestions(
      filterOptionsByIndex(options, SearchIndex.DATA_PRODUCT)
    );
    setDatabaseSuggestions(filterOptionsByIndex(options, SearchIndex.DATABASE));
    setDatabaseSchemaSuggestions(
      filterOptionsByIndex(options, SearchIndex.DATABASE_SCHEMA)
    );

    setChartSuggestions(filterOptionsByIndex(options, SearchIndex.CHART));

    setApiCollectionSuggestions(
      filterOptionsByIndex(options, SearchIndex.API_COLLECTION_INDEX)
    );

    setApiEndpointSuggestions(
      filterOptionsByIndex(options, SearchIndex.API_ENDPOINT_INDEX)
    );
    setMetricSuggestions(
      filterOptionsByIndex(options, SearchIndex.METRIC_SEARCH_INDEX)
    );
  };

  const quickFilter = useMemo(() => {
    const parsedSearch = Qs.parse(
      location.search.startsWith('?')
        ? location.search.substring(1)
        : location.search
    );

    return !isString(parsedSearch.quickFilter)
      ? {}
      : JSON.parse(parsedSearch.quickFilter);
  }, [location.search]);

  const getSuggestionsForIndex = (
    suggestions: SearchSuggestions,
    searchIndex: SearchIndex
  ) => {
    if (suggestions.length === 0) {
      return null;
    }

    return (
      <div data-testid={`group-${searchIndex}`}>
        {getGroupLabel(searchIndex)}
        {suggestions.map((suggestion: SearchSuggestions[number]) => {
          return getSuggestionElement(suggestion, () => setIsOpen(false));
        })}
      </div>
    );
  };

  const getEntitiesSuggestions = () => {
    return (
      <div data-testid="global-search-suggestion-box" role="none">
        {[
          { suggestions: tableSuggestions, searchIndex: SearchIndex.TABLE },
          { suggestions: topicSuggestions, searchIndex: SearchIndex.TOPIC },
          {
            suggestions: dashboardSuggestions,
            searchIndex: SearchIndex.DASHBOARD,
          },
          {
            suggestions: pipelineSuggestions,
            searchIndex: SearchIndex.PIPELINE,
          },
          { suggestions: mlModelSuggestions, searchIndex: SearchIndex.MLMODEL },
          {
            suggestions: containerSuggestions,
            searchIndex: SearchIndex.CONTAINER,
          },
          {
            suggestions: searchIndexSuggestions,
            searchIndex: SearchIndex.SEARCH_INDEX,
          },
          {
            suggestions: storedProcedureSuggestions,
            searchIndex: SearchIndex.STORED_PROCEDURE,
          },
          {
            suggestions: dataModelSuggestions,
            searchIndex: SearchIndex.DASHBOARD_DATA_MODEL,
          },
          {
            suggestions: glossaryTermSuggestions,
            searchIndex: SearchIndex.GLOSSARY_TERM,
          },
          {
            suggestions: databaseSuggestions,
            searchIndex: SearchIndex.DATABASE,
          },
          {
            suggestions: databaseSchemaSuggestions,
            searchIndex: SearchIndex.DATABASE_SCHEMA,
          },
          { suggestions: tagSuggestions, searchIndex: SearchIndex.TAG },
          {
            suggestions: dataProductSuggestions,
            searchIndex: SearchIndex.DATA_PRODUCT,
          },
          {
            suggestions: chartSuggestions,
            searchIndex: SearchIndex.CHART,
          },
          {
            suggestions: apiCollectionSuggestions,
            searchIndex: SearchIndex.API_COLLECTION_INDEX,
          },
          {
            suggestions: apiEndpointSuggestions,
            searchIndex: SearchIndex.API_ENDPOINT_INDEX,
          },
          {
            suggestions: metricSuggestions,
            searchIndex: SearchIndex.METRIC_SEARCH_INDEX,
          },
          ...searchClassBase.getEntitiesSuggestions(options ?? []),
        ].map(({ suggestions, searchIndex }) =>
          getSuggestionsForIndex(suggestions, searchIndex)
        )}
      </div>
    );
  };

  const fetchSearchData = useCallback(async () => {
    if (isNLPActive) {
      return;
    }

    try {
      setIsLoading(true);

      const res = await searchQuery({
        query: searchText,
        searchIndex: searchCriteria ?? SearchIndex.DATA_ASSET,
        queryFilter: quickFilter,
        pageSize: PAGE_SIZE_BASE,
        includeDeleted: false,
      });

      setOptions(res.hits.hits as unknown as Option[]);
      updateSuggestions(res.hits.hits as unknown as Option[]);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.suggestion-lowercase-plural'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [searchText, searchCriteria]);

  useEffect(() => {
    if (!isMounting.current && searchText && !isTourOpen) {
      fetchSearchData();
    } else {
      setIsLoading(false);
    }
  }, [searchText, searchCriteria]);

  // always Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  // Add a function to render AI query suggestions
  const renderAIQuerySuggestions = () => {
    const aiQueries = [
      'Tables owned by marketing',
      'Tables with Tier1 classification',
      'Find dashboards tagged with PII.Sensitive',
      'Topics with schema fields containing address',
      'Tables tagged with tier1 or tier2',
    ];

    return (
      <div data-testid="ai-query-suggestions">
        <Typography.Text strong className="m-b-sm d-block">
          {t('label.ai-queries')}
        </Typography.Text>
        {aiQueries.map((query) => (
          <Button
            block
            className="m-b-md w-100 text-left d-flex items-center p-0"
            data-testid="nlp-suggestions-button"
            icon={
              <div className="nlp-button w-6 h-6 flex-center m-r-md">
                <IconSuggestionsBlue />
              </div>
            }
            key={query}
            type="text"
            onClick={() => onSearchTextUpdate?.(query)}>
            {query}
          </Button>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <Loader />;
  }

  // Add a condition to show AI query suggestions when searchText is empty and isNLPActive is true
  if (isEmpty(searchText) && isNLPActive) {
    return renderAIQuerySuggestions();
  }

  if (options.length === 0 && !isTourOpen && !isEmpty(searchText)) {
    return (
      <Typography.Text>
        <Transi18next
          i18nKey="message.please-enter-to-find-data-assets"
          renderElement={<strong />}
          values={{
            keyword: `"${searchText}"`,
          }}
        />
      </Typography.Text>
    );
  }

  return getEntitiesSuggestions();
};

export default Suggestions;
