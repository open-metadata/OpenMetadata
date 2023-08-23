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
import Loader from 'components/Loader/Loader';
import { ContainerSearchSource } from 'interface/search.interface';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSuggestions } from 'rest/miscAPI';
import {
  filterOptionsByIndex,
  getGroupLabel,
  getSuggestionElement,
} from 'utils/SearchUtils';
import { SearchIndex } from '../../enums/search.enum';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  DashboardSource,
  GlossarySource,
  MlModelSource,
  Option,
  PipelineSource,
  SearchSuggestions,
  TableSource,
  TagSource,
  TopicSource,
} from '../GlobalSearchProvider/GlobalSearchSuggestions/GlobalSearchSuggestions.interface';

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
  const [glossarySuggestions, setGlossarySuggestions] = useState<
    GlossarySource[]
  >([]);
  const [tagSuggestions, setTagSuggestions] = useState<TagSource[]>([]);
  const isMounting = useRef(true);

  const setSuggestions = (options: Array<Option>) => {
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
    setGlossarySuggestions(filterOptionsByIndex(options, SearchIndex.GLOSSARY));
    setTagSuggestions(filterOptionsByIndex(options, SearchIndex.TAG));
  };

  const getSuggestionsForIndex = (
    suggestions: SearchSuggestions,
    searchIndex: SearchIndex
  ) => {
    if (suggestions.length === 0) {
      return null;
    }

    return (
      <>
        {getGroupLabel(searchIndex)}
        {suggestions.map((suggestion: SearchSuggestions[number]) => {
          return getSuggestionElement(suggestion, searchIndex, () =>
            setIsOpen(false)
          );
        })}
      </>
    );
  };

  const getEntitiesSuggestions = () => {
    return (
      <div role="none">
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
            suggestions: glossarySuggestions,
            searchIndex: SearchIndex.GLOSSARY,
          },
          { suggestions: tagSuggestions, searchIndex: SearchIndex.TAG },
        ].map(({ suggestions, searchIndex }) =>
          getSuggestionsForIndex(suggestions, searchIndex)
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!isMounting.current && searchText) {
      setIsLoading(true);
      getSuggestions(searchText, searchCriteria)
        .then((res) => {
          if (res.data) {
            setOptions(
              res.data.suggest['metadata-suggest'][0]
                .options as unknown as Option[]
            );
            setSuggestions(
              res.data.suggest['metadata-suggest'][0]
                .options as unknown as Option[]
            );
          } else {
            throw t('server.unexpected-response');
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            t('server.entity-fetch-error', {
              entity: t('label.suggestion-lowercase-plural'),
            })
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [searchText, searchCriteria]);

  // always Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (options.length === 0) {
    return <Typography.Text>{t('message.no-match-found')}</Typography.Text>;
  }

  return getEntitiesSuggestions();
};

export default Suggestions;
