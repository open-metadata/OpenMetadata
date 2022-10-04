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

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { suggestQuery } from '../../axiosAPIs/searchAPI';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { FqnPart } from '../../enums/entity.enum';
import { GENERAL_SEARCH_INDEX, SearchIndex } from '../../enums/search.enum';
import {
  DashboardSearchSource,
  MlmodelSearchSource,
  PipelineSearchSource,
  SuggestResponse,
  TableSearchSource,
  TopicSearchSource,
} from '../../interface/search.interface';
import { getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { getEntityLink } from '../../utils/TableUtils';

export interface SuggestionsProps {
  searchText: string;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}

type FormattedDataFields = 'fullyQualifiedName' | 'name' | 'serviceType';

const Suggestions: React.FC<SuggestionsProps> = ({
  searchText,
  isOpen,
  setIsOpen,
}) => {
  const [tableSuggestions, setTableSuggestions] = useState<
    Pick<TableSearchSource, FormattedDataFields>[]
  >([]);
  const [topicSuggestions, setTopicSuggestions] = useState<
    Pick<TopicSearchSource, FormattedDataFields>[]
  >([]);

  const [dashboardSuggestions, setDashboardSuggestions] = useState<
    Pick<DashboardSearchSource, FormattedDataFields>[]
  >([]);

  const [pipelineSuggestions, setPipelineSuggestions] = useState<
    Pick<PipelineSearchSource, FormattedDataFields>[]
  >([]);
  const [mlModelSuggestions, setMlModelSuggestions] = useState<
    Pick<MlmodelSearchSource, FormattedDataFields>[]
  >([]);
  const isMounting = useRef(true);

  const setSuggestions = (
    options: SuggestResponse<
      typeof GENERAL_SEARCH_INDEX[number],
      'name' | 'fullyQualifiedName' | 'serviceType'
    >
  ) => {
    setTableSuggestions(
      options
        .filter(({ _index }) => _index === SearchIndex.TABLE)
        .map(({ _source }) => _source as TableSearchSource)
    );
    setTopicSuggestions(
      options
        .filter(({ _index }) => _index === SearchIndex.TOPIC)
        .map(({ _source }) => _source as TopicSearchSource)
    );
    setDashboardSuggestions(
      options
        .filter(({ _index }) => _index === SearchIndex.DASHBOARD)
        .map(({ _source }) => _source as DashboardSearchSource)
    );
    setPipelineSuggestions(
      options
        .filter(({ _index }) => _index === SearchIndex.PIPELINE)
        .map(({ _source }) => _source as PipelineSearchSource)
    );
    setMlModelSuggestions(
      options
        .filter(({ _index }) => _index === SearchIndex.MLMODEL)
        .map(({ _source }) => _source as MlmodelSearchSource)
    );
  };

  const getGroupLabel = (index: string) => {
    let label = '';
    let icon = '';
    switch (index) {
      case SearchIndex.TOPIC:
        label = 'Topics';
        icon = Icons.TOPIC_GREY;

        break;
      case SearchIndex.DASHBOARD:
        label = 'Dashboards';
        icon = Icons.DASHBOARD_GREY;

        break;
      case SearchIndex.PIPELINE:
        label = 'Pipelines';
        icon = Icons.PIPELINE_GREY;

        break;
      case SearchIndex.MLMODEL:
        label = 'ML Models';
        // TODO: Change this to mlmodel icon
        icon = Icons.SERVICE;

        break;
      case SearchIndex.TABLE:
      default:
        label = 'Tables';
        icon = Icons.TABLE_GREY;

        break;
    }

    return (
      <div className="tw-flex tw-items-center tw-my-2">
        <SVGIcons alt="icon" className="tw-h-4 tw-w-4 tw-ml-2" icon={icon} />
        <p className="tw-px-2 tw-text-grey-muted tw-text-xs tw-h-4 tw-mb-0">
          {label}
        </p>
      </div>
    );
  };

  const getSuggestionElement = (
    fqdn: string,
    serviceType: string,
    name: string,
    index: string
  ) => {
    let database;
    let schema;
    if (index === SearchIndex.TABLE) {
      database = getPartialNameFromTableFQN(fqdn, [FqnPart.Database]);
      schema = getPartialNameFromTableFQN(fqdn, [FqnPart.Schema]);
    }

    return (
      <div
        className="tw-flex tw-items-center hover:tw-bg-body-hover"
        data-testid={`${getPartialNameFromTableFQN(fqdn, [
          FqnPart.Service,
        ])}-${name}`}
        key={fqdn}>
        <img
          alt={serviceType}
          className="tw-inline tw-h-4 tw-ml-2"
          src={serviceTypeLogo(serviceType)}
        />
        <Link
          className="tw-block tw-px-4 tw-py-2 tw-text-sm"
          data-testid="data-name"
          id={fqdn.replace(/\./g, '')}
          to={getEntityLink(index, fqdn)}
          onClick={() => setIsOpen(false)}>
          {database && schema
            ? `${database}${FQN_SEPARATOR_CHAR}${schema}${FQN_SEPARATOR_CHAR}${name}`
            : name}
        </Link>
      </div>
    );
  };

  const getEntitiesSuggestions = () => {
    return (
      <div className="py-1" role="none">
        {tableSuggestions.length > 0 && (
          <>
            {getGroupLabel(SearchIndex.TABLE)}

            {tableSuggestions.map((suggestion) => {
              const { fullyQualifiedName, name, serviceType } = suggestion;

              return getSuggestionElement(
                fullyQualifiedName ?? '',
                serviceType ?? '',
                name,
                SearchIndex.TABLE
              );
            })}
          </>
        )}
        {topicSuggestions.length > 0 && (
          <>
            {getGroupLabel(SearchIndex.TOPIC)}

            {topicSuggestions.map((suggestion) => {
              const { fullyQualifiedName, name, serviceType } = suggestion;

              return getSuggestionElement(
                fullyQualifiedName ?? '',
                serviceType ?? '',
                name,
                SearchIndex.TOPIC
              );
            })}
          </>
        )}
        {dashboardSuggestions.length > 0 && (
          <>
            {getGroupLabel(SearchIndex.DASHBOARD)}

            {dashboardSuggestions.map((suggestion) => {
              const { fullyQualifiedName, name, serviceType } = suggestion;

              return getSuggestionElement(
                fullyQualifiedName ?? '',
                serviceType ?? '',
                name,
                SearchIndex.DASHBOARD
              );
            })}
          </>
        )}
        {pipelineSuggestions.length > 0 && (
          <>
            {getGroupLabel(SearchIndex.PIPELINE)}

            {pipelineSuggestions.map((suggestion) => {
              const { fullyQualifiedName, name, serviceType } = suggestion;

              return getSuggestionElement(
                fullyQualifiedName ?? '',
                serviceType ?? '',
                name,
                SearchIndex.PIPELINE
              );
            })}
          </>
        )}
        {mlModelSuggestions.length > 0 && (
          <>
            {getGroupLabel(SearchIndex.MLMODEL)}

            {mlModelSuggestions.map((suggestion) => {
              const { fullyQualifiedName, name, serviceType } = suggestion;

              return getSuggestionElement(
                fullyQualifiedName ?? '',
                serviceType ?? '',
                name,
                SearchIndex.MLMODEL
              );
            })}
          </>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!isMounting.current) {
      suggestQuery({
        query: searchText,
        searchIndex: GENERAL_SEARCH_INDEX,
        fetchSource: true,
        // includeFields: ['name', 'serviceType', 'fullyQualifiedName'],
      }).then((options) => {
        setSuggestions(options);
        setIsOpen(true);
      });
    }
  }, [searchText]);

  // always Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  return (
    <>
      {isOpen ? (
        <>
          <button
            className="tw-z-10 tw-fixed tw-inset-0 tw-h-full tw-w-full tw-bg-black tw-opacity-0 "
            data-testid="suggestion-overlay"
            onClick={() => setIsOpen(false)}
          />
          <div
            aria-labelledby="menu-button"
            aria-orientation="vertical"
            className="tw-origin-top-right tw-absolute tw-z-20
          tw-w-600 tw-mt-1 tw-rounded-md tw-shadow-lg
        tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none tw-ml-4"
            role="menu">
            {getEntitiesSuggestions()}
          </div>
        </>
      ) : null}
    </>
  );
};

export default Suggestions;
