/*
 *  Copyright 2022 Collate
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

import { Select } from 'antd';
import { BaseSelectRef } from 'rc-select';
import { AxiosError, AxiosResponse } from 'axios';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { getSuggestions } from '../../../axiosAPIs/miscAPI';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { FqnPart } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import jsonData from '../../../jsons/en';
import { getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import { serviceTypeLogo } from '../../../utils/ServiceUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { getEntityLink } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  DashboardSource,
  GlobalSearchSuggestionsProp,
  MlModelSource,
  Option,
  PipelineSource,
  TableSource,
  TopicSource,
} from './GlobalSearchSuggestions.interface';

const GlobalSearchSuggestions = forwardRef<
  BaseSelectRef,
  GlobalSearchSuggestionsProp
>(
  (
    {
      searchText,
      onOptionSelection,
      value,
      onInputKeyDown,
      onSearch,
    }: GlobalSearchSuggestionsProp,
    ref
  ) => {
    const history = useHistory();
    const [options, setOptions] = useState<Array<Option>>([]);
    const [tableSuggestions, setTableSuggestions] = useState<TableSource[]>([]);
    const [topicSuggestions, setTopicSuggestions] = useState<TopicSource[]>([]);
    const [dashboardSuggestions, setDashboardSuggestions] = useState<
      DashboardSource[]
    >([]);

    const [pipelineSuggestions, setPipelineSuggestions] = useState<
      PipelineSource[]
    >([]);
    const [mlModelSuggestions, setMlModelSuggestions] = useState<
      MlModelSource[]
    >([]);
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
        <Select.Option disabled>
          <div className="tw-flex tw-items-center">
            <SVGIcons alt="icon" className="tw-h-3 tw-w-4" icon={icon} />
            <p className="tw-px-2 tw-text-grey-muted tw-text-xs tw-h-4 tw-mb-0">
              {label}
            </p>
          </div>
        </Select.Option>
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
      const entitiyLink = getEntityLink(index, fqdn);

      return (
        <Select.Option key={entitiyLink} value={entitiyLink}>
          <div className="tw-flex tw-items-center" key={fqdn}>
            <img
              alt={serviceType}
              className="tw-inline tw-h-4"
              src={serviceTypeLogo(serviceType)}
            />
            <Link
              className="tw-px-2 tw-text-sm"
              data-testid="data-name"
              id={fqdn.replace(/\./g, '')}
              to={entitiyLink}
              onClick={() => onOptionSelection()}>
              {database && schema
                ? `${database}${FQN_SEPARATOR_CHAR}${schema}${FQN_SEPARATOR_CHAR}${name}`
                : name}
            </Link>
          </div>
        </Select.Option>
      );
    };

    const getEntitiesSuggestions = () => {
      return (
        <>
          {tableSuggestions.length > 0 && (
            <>
              {getGroupLabel(SearchIndex.TABLE)}

              {tableSuggestions.map((suggestion: TableSource) => {
                const { fullyQualifiedName, name, serviceType } = suggestion;

                return getSuggestionElement(
                  fullyQualifiedName,
                  serviceType,
                  name,
                  SearchIndex.TABLE
                );
              })}
            </>
          )}
          {topicSuggestions.length > 0 && (
            <>
              {getGroupLabel(SearchIndex.TOPIC)}

              {topicSuggestions.map((suggestion: TopicSource) => {
                const { fullyQualifiedName, name, serviceType } = suggestion;

                return getSuggestionElement(
                  fullyQualifiedName,
                  serviceType,
                  name,
                  SearchIndex.TOPIC
                );
              })}
            </>
          )}
          {dashboardSuggestions.length > 0 && (
            <>
              {getGroupLabel(SearchIndex.DASHBOARD)}

              {dashboardSuggestions.map((suggestion: DashboardSource) => {
                const { fullyQualifiedName, name, serviceType } = suggestion;

                return getSuggestionElement(
                  fullyQualifiedName,
                  serviceType,
                  name,
                  SearchIndex.DASHBOARD
                );
              })}
            </>
          )}
          {pipelineSuggestions.length > 0 && (
            <>
              {getGroupLabel(SearchIndex.PIPELINE)}

              {pipelineSuggestions.map((suggestion: PipelineSource) => {
                const { fullyQualifiedName, name, serviceType } = suggestion;

                return getSuggestionElement(
                  fullyQualifiedName,
                  serviceType,
                  name,
                  SearchIndex.PIPELINE
                );
              })}
            </>
          )}
          {mlModelSuggestions.length > 0 && (
            <>
              {getGroupLabel(SearchIndex.MLMODEL)}

              {mlModelSuggestions.map((suggestion: MlModelSource) => {
                const { fullyQualifiedName, name, serviceType } = suggestion;

                return getSuggestionElement(
                  fullyQualifiedName,
                  serviceType,
                  name,
                  SearchIndex.MLMODEL
                );
              })}
            </>
          )}
        </>
      );
    };

    useEffect(() => {
      if (!isMounting.current) {
        getSuggestions(searchText)
          .then((res: AxiosResponse) => {
            if (res.data) {
              setOptions(res.data.suggest['metadata-suggest'][0].options);
              setSuggestions(res.data.suggest['metadata-suggest'][0].options);
            } else {
              throw jsonData['api-error-messages'][
                'unexpected-server-response'
              ];
            }
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              jsonData['api-error-messages']['fetch-suggestions-error']
            );
          });
      }
    }, [searchText]);

    // always Keep this useEffect at the end...
    useEffect(() => {
      isMounting.current = false;
    }, []);

    return (
      <div className="tw-flex tw-border tw-rounded">
        <SVGIcons
          alt="icon-search"
          className="tw-ml-2 tw-mr-1"
          icon="icon-searchv1"
        />
        <Select
          showSearch
          bordered={false}
          defaultActiveFirstOption={false}
          dropdownMatchSelectWidth={613}
          dropdownStyle={{
            paddingTop: '10px',
            boxShadow: 'none',
          }}
          filterOption={false}
          listHeight={220}
          notFoundContent={null}
          placement="bottomRight"
          ref={ref}
          showArrow={false}
          size="large"
          style={{ width: '572px' }}
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
  }
);

export default GlobalSearchSuggestions;
