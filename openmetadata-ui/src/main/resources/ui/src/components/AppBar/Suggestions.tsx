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

import { Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import {
  DashboardSource,
  DataProductSource,
  GlossarySource,
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
import { searchData } from '../../rest/miscAPI';
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
};

const Suggestions = ({
  searchText,
  setIsOpen,
  searchCriteria,
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
  };

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
          return getSuggestionElement(suggestion, searchIndex, () =>
            setIsOpen(false)
          );
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
          { suggestions: tagSuggestions, searchIndex: SearchIndex.TAG },
          {
            suggestions: dataProductSuggestions,
            searchIndex: SearchIndex.DATA_PRODUCT,
          },
          ...searchClassBase.getEntitiesSuggestions(options ?? []),
        ].map(({ suggestions, searchIndex }) =>
          getSuggestionsForIndex(suggestions, searchIndex)
        )}
      </div>
    );
  };

  const fetchSearchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await searchData(
        searchText,
        1,
        PAGE_SIZE_BASE,
        '',
        '',
        '',
        searchCriteria ?? SearchIndex.DATA_ASSET,
        false,
        false,
        false
      );

      if (res.data) {
        setOptions(res.data.hits.hits as unknown as Option[]);
        updateSuggestions(res.data.hits.hits as unknown as Option[]);
      }
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

  if (isLoading) {
    return <Loader />;
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
