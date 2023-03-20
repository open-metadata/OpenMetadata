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
import { isEmpty } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getSuggestions } from 'rest/miscAPI';
import { getGroupLabel, getSuggestionElement } from 'utils/SearchUtils';
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
  const [mlModelSuggestions, setMlModelSuggestions] = useState<MlModelSource[]>(
    []
  );
  const [glossarySuggestions, setGlossarySuggestions] = useState<
    GlossarySource[]
  >([]);
  const [tagSuggestions, setTagSuggestions] = useState<TagSource[]>([]);
  const isMounting = useRef(true);

  const setSuggestions = (options: Array<Option>) => {
    setTableSuggestions(
      options
        .filter((option) => option._index === SearchIndex.TABLE)
        .map((option) => option._source)
    );
    setTopicSuggestions(
      options
        .filter((option) => option._index === SearchIndex.TOPIC)
        .map((option) => option._source)
    );
    setDashboardSuggestions(
      options
        .filter((option) => option._index === SearchIndex.DASHBOARD)
        .map((option) => option._source)
    );
    setPipelineSuggestions(
      options
        .filter((option) => option._index === SearchIndex.PIPELINE)
        .map((option) => option._source)
    );
    setMlModelSuggestions(
      options
        .filter((option) => option._index === SearchIndex.MLMODEL)
        .map((option) => option._source)
    );
    setGlossarySuggestions(
      options
        .filter((option) => option._index === SearchIndex.GLOSSARY)
        .map((option) => option._source)
    );
    setTagSuggestions(
      options
        .filter((option) => option._index === SearchIndex.TAG)
        .map((option) => option._source)
    );
  };

  const getSuggestionsForIndex = (
    suggestions:
      | TableSource[]
      | TopicSource[]
      | PipelineSource[]
      | TagSource[]
      | GlossarySource[]
      | DashboardSource[]
      | MlModelSource[],
    searchIndex: SearchIndex
  ) => {
    if (suggestions.length === 0) {
      return null;
    }

    return (
      <>
        {getGroupLabel(searchIndex, true)}
        {suggestions.map(
          (
            suggestion:
              | TableSource
              | TopicSource
              | PipelineSource
              | TagSource
              | GlossarySource
              | DashboardSource
              | MlModelSource
          ) => {
            const { fullyQualifiedName, name, serviceType } = suggestion;

            return getSuggestionElement(
              fullyQualifiedName,
              serviceType,
              name,
              searchIndex,
              true,
              () => onOptionSelection()
            );
          }
        )}
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
