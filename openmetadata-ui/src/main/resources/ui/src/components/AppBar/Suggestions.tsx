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
import { ReactComponent as IconSuggestionsBlue } from '../../assets/svg/ic-suggestions-blue.svg';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import {
  Option,
  SearchSuggestions,
  SuggestionsObject,
} from '../../context/GlobalSearchProvider/GlobalSearchSuggestions/GlobalSearchSuggestions.interface';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { SearchIndex } from '../../enums/search.enum';
import { searchQuery } from '../../rest/searchAPI';
import { Transi18next } from '../../utils/CommonUtils';
import searchClassBase from '../../utils/SearchClassBase';
import {
  filterOptionsByIndex,
  getGroupLabel,
  getSuggestionElement,
} from '../../utils/SearchUtils';
import { escapeESReservedCharacters } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import './suggestions.less';

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
  const [suggestions, setSuggestions] = useState<SuggestionsObject>({
    tableSuggestions: [],
    topicSuggestions: [],
    dashboardSuggestions: [],
    pipelineSuggestions: [],
    mlModelSuggestions: [],
    containerSuggestions: [],
    glossaryTermSuggestions: [],
    databaseSuggestions: [],
    databaseSchemaSuggestions: [],
    searchIndexSuggestions: [],
    tagSuggestions: [],
    storedProcedureSuggestions: [],
    dataModelSuggestions: [],
    dataProductSuggestions: [],
    chartSuggestions: [],
    apiEndpointSuggestions: [],
    apiCollectionSuggestions: [],
    metricSuggestions: [],
    directorySuggestions: [],
    fileSuggestions: [],
    spreadsheetSuggestions: [],
    worksheetSuggestions: [],
  });

  const {
    tableSuggestions,
    topicSuggestions,
    dashboardSuggestions,
    pipelineSuggestions,
    mlModelSuggestions,
    containerSuggestions,
    glossaryTermSuggestions,
    databaseSuggestions,
    databaseSchemaSuggestions,
    searchIndexSuggestions,
    tagSuggestions,
    storedProcedureSuggestions,
    dataModelSuggestions,
    dataProductSuggestions,
    chartSuggestions,
    apiEndpointSuggestions,
    apiCollectionSuggestions,
    metricSuggestions,
  } = suggestions;

  const isMounting = useRef(true);

  const updateSuggestions = (options: Array<Option>) => {
    setSuggestions(() => ({
      tableSuggestions: filterOptionsByIndex(options, SearchIndex.TABLE),
      topicSuggestions: filterOptionsByIndex(options, SearchIndex.TOPIC),
      dashboardSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.DASHBOARD
      ),
      pipelineSuggestions: filterOptionsByIndex(options, SearchIndex.PIPELINE),
      mlModelSuggestions: filterOptionsByIndex(options, SearchIndex.MLMODEL),
      containerSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.CONTAINER
      ),
      glossaryTermSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.GLOSSARY_TERM
      ),
      databaseSuggestions: filterOptionsByIndex(options, SearchIndex.DATABASE),
      databaseSchemaSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.DATABASE_SCHEMA
      ),
      searchIndexSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.SEARCH_INDEX
      ),
      tagSuggestions: filterOptionsByIndex(options, SearchIndex.TAG),
      storedProcedureSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.STORED_PROCEDURE
      ),
      dataModelSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.DASHBOARD_DATA_MODEL
      ),
      dataProductSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.DATA_PRODUCT
      ),
      chartSuggestions: filterOptionsByIndex(options, SearchIndex.CHART),
      apiEndpointSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.API_ENDPOINT_INDEX
      ),
      apiCollectionSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.API_COLLECTION_INDEX
      ),
      metricSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.METRIC_SEARCH_INDEX
      ),
      directorySuggestions: filterOptionsByIndex(
        options,
        SearchIndex.DIRECTORY_SEARCH_INDEX
      ),
      fileSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.FILE_SEARCH_INDEX
      ),
      spreadsheetSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.SPREADSHEET_SEARCH_INDEX
      ),
      worksheetSuggestions: filterOptionsByIndex(
        options,
        SearchIndex.WORKSHEET_SEARCH_INDEX
      ),
    }));
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
      <div
        className="global-search-suggestion-box"
        data-testid="global-search-suggestion-box"
        role="none">
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
          {
            suggestions: suggestions.directorySuggestions,
            searchIndex: SearchIndex.DIRECTORY_SEARCH_INDEX,
          },
          {
            suggestions: suggestions.fileSuggestions,
            searchIndex: SearchIndex.FILE_SEARCH_INDEX,
          },
          {
            suggestions: suggestions.spreadsheetSuggestions,
            searchIndex: SearchIndex.SPREADSHEET_SEARCH_INDEX,
          },
          {
            suggestions: suggestions.worksheetSuggestions,
            searchIndex: SearchIndex.WORKSHEET_SEARCH_INDEX,
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
        query: escapeESReservedCharacters(searchText),
        searchIndex: searchCriteria ?? SearchIndex.DATA_ASSET,
        queryFilter: quickFilter,
        pageSize: PAGE_SIZE_BASE,
        includeDeleted: false,
        excludeSourceFields: ['columns', 'queries', 'columnNames'],
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
