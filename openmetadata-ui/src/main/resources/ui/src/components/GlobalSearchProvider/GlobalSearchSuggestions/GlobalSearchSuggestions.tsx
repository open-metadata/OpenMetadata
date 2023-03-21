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

import { Select, Typography } from 'antd';
import { AxiosError } from 'axios';
import { ContainerSearchSource } from 'interface/search.interface';
import { isEmpty } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getSuggestions } from 'rest/miscAPI';
import {
  filterOptionsByIndex,
  getGroupLabel,
  getSuggestionElement,
} from 'utils/SearchUtils';
import { SearchIndex } from '../../../enums/search.enum';
import jsonData from '../../../jsons/en';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import CmdKIcon from '../../common/CmdKIcon/CmdKIcon.component';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../../Loader/Loader';
import {
  DashboardSource,
  GlobalSearchSuggestionsProp,
  GlossarySource,
  MlModelSource,
  Option,
  PipelineSource,
  SearchSuggestions,
  TableSource,
  TagSource,
  TopicSource,
} from './GlobalSearchSuggestions.interface';
import './GlobalSearchSuggestions.less';

const GlobalSearchSuggestions = ({
  isSuggestionsLoading,
  handleIsSuggestionsLoading,
  searchText,
  onOptionSelection,
  value,
  onInputKeyDown,
  onSearch,
  selectRef,
}: GlobalSearchSuggestionsProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [options, setOptions] = useState<Option[]>([]);
  const [tableSuggestions, setTableSuggestions] = useState<TableSource[]>([]);
  const [topicSuggestions, setTopicSuggestions] = useState<TopicSource[]>([]);
  const [dashboardSuggestions, setDashboardSuggestions] = useState<
    DashboardSource[]
  >([]);

  const [pipelineSuggestions, setPipelineSuggestions] = useState<
    PipelineSource[]
  >([]);
  const [containerSuggestions, setContainerSuggestions] = useState<
    ContainerSearchSource[]
  >([]);
  const [mlModelSuggestions, setMlModelSuggestions] = useState<MlModelSource[]>(
    []
  );
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
        {getGroupLabel(searchIndex, true)}
        {suggestions.map((suggestion: SearchSuggestions[number]) => {
          return getSuggestionElement(suggestion, searchIndex, true, () =>
            onOptionSelection()
          );
        })}
      </>
    );
  };

  const getEntitiesSuggestions = () => {
    return (
      <>
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
      </>
    );
  };

  useEffect(() => {
    if (!isMounting.current) {
      getSuggestions(searchText)
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
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-suggestions-error']
          );
        })
        .finally(() => {
          handleIsSuggestionsLoading(false);
        });
    }
  }, [searchText]);

  // always Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  return (
    <div className="tw-flex tw-items-center tw-border tw-rounded">
      <SVGIcons
        alt={Icons.SEARCHV1}
        className="tw-ml-2 tw-mr-1 tw-h-4"
        icon={Icons.SEARCHV1}
      />
      <Select
        autoFocus
        showSearch
        bordered={false}
        className="global-search-input"
        defaultActiveFirstOption={false}
        dropdownMatchSelectWidth={613}
        dropdownStyle={{
          paddingTop: '10px',
          boxShadow: 'none',
        }}
        filterOption={false}
        listHeight={220}
        notFoundContent={
          <div className="tw-flex tw-flex-col tw-w-full tw-h-56 tw-items-center tw-justify-center tw-pb-9">
            {isSuggestionsLoading ? (
              <Loader size="small" />
            ) : (
              <ErrorPlaceHolder classes="tw-mt-0 opacity-60">
                <Typography.Text className="tw-text-sm tw-grey-body ">
                  {t('message.no-data-available')}
                </Typography.Text>
              </ErrorPlaceHolder>
            )}
          </div>
        }
        open={!isEmpty(value)}
        placeholder={t('label.search')}
        placement="bottomRight"
        ref={selectRef}
        size="large"
        style={{ width: '572px' }}
        suffixIcon={<CmdKIcon />}
        transitionName=""
        value={value}
        onChange={(value) => {
          history.push(value);
          onOptionSelection();
        }}
        onInputKeyDown={onInputKeyDown}
        onSearch={onSearch}>
        {options.length > 0 ? getEntitiesSuggestions() : null}
      </Select>
    </div>
  );
};

export default GlobalSearchSuggestions;
