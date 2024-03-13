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

import { SearchOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import i18next from 'i18next';
import { isEmpty } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as IconDashboard } from '../assets/svg/dashboard-grey.svg';
import { ReactComponent as DataProductIcon } from '../assets/svg/ic-data-product.svg';
import { ReactComponent as IconContainer } from '../assets/svg/ic-storage.svg';
import { ReactComponent as IconStoredProcedure } from '../assets/svg/ic-stored-procedure.svg';
import { ReactComponent as IconMlModal } from '../assets/svg/mlmodal.svg';
import { ReactComponent as IconPipeline } from '../assets/svg/pipeline-grey.svg';
import { ReactComponent as IconTable } from '../assets/svg/table-grey.svg';
import { ReactComponent as IconTag } from '../assets/svg/tag-grey.svg';
import { ReactComponent as IconTopic } from '../assets/svg/topic-grey.svg';
import {
  FQN_SEPARATOR_CHAR,
  WILD_CARD_CHAR,
} from '../constants/char.constants';
import {
  Option,
  SearchSuggestions,
} from '../context/GlobalSearchProvider/GlobalSearchSuggestions/GlobalSearchSuggestions.interface';
import { EntityType, FqnPart } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { SearchSourceAlias } from '../interface/search.interface';
import { getPartialNameFromTableFQN } from './CommonUtils';
import searchClassBase from './SearchClassBase';
import serviceUtilClassBase from './ServiceUtilClassBase';
import { escapeESReservedCharacters } from './StringsUtils';

export const getSearchAPIQueryParams = (
  queryString: string,
  from: number,
  size: number,
  filters: string,
  sortField: string,
  sortOrder: string,
  searchIndex: SearchIndex | SearchIndex[],
  onlyDeleted = false,
  trackTotalHits = false,
  wildcard = true
): Record<string, string | boolean | number | string[]> => {
  const start = (from - 1) * size;

  const encodedQueryString = queryString
    ? escapeESReservedCharacters(queryString)
    : '';

  const query =
    wildcard && encodedQueryString !== WILD_CARD_CHAR
      ? `*${encodedQueryString}*`
      : encodedQueryString;

  const params: Record<string, string | boolean | number | string[]> = {
    q: query + (filters ? ` AND ${filters}` : ''),
    from: start,
    size,
    index: searchIndex,
  };

  if (onlyDeleted) {
    params.deleted = onlyDeleted;
  }

  if (!isEmpty(sortField)) {
    params.sort_field = sortField;
  }

  if (!isEmpty(sortOrder)) {
    params.sort_order = sortOrder;
  }

  if (trackTotalHits) {
    params.track_total_hits = trackTotalHits;
  }

  return params;
};

// will add back slash "\" before quote in string if present
export const getQueryWithSlash = (query: string): string =>
  query.replace(/["']/g, '\\$&');

export const getGroupLabel = (index: string) => {
  let label = '';
  let GroupIcon;
  switch (index) {
    case SearchIndex.TOPIC:
      label = i18next.t('label.topic-plural');
      GroupIcon = IconTopic;

      break;
    case SearchIndex.DASHBOARD:
      label = i18next.t('label.dashboard-plural');
      GroupIcon = IconDashboard;

      break;
    case SearchIndex.PIPELINE:
      label = i18next.t('label.pipeline-plural');
      GroupIcon = IconPipeline;

      break;
    case SearchIndex.MLMODEL:
      label = i18next.t('label.ml-model-plural');
      GroupIcon = IconMlModal;

      break;
    case SearchIndex.GLOSSARY_TERM:
      label = i18next.t('label.glossary-term-plural');
      GroupIcon = IconTable;

      break;
    case SearchIndex.TAG:
      label = i18next.t('label.tag-plural');
      GroupIcon = IconTag;

      break;
    case SearchIndex.CONTAINER:
      label = i18next.t('label.container-plural');
      GroupIcon = IconContainer;

      break;

    case SearchIndex.STORED_PROCEDURE:
      label = i18next.t('label.stored-procedure-plural');
      GroupIcon = IconStoredProcedure;

      break;

    case SearchIndex.DASHBOARD_DATA_MODEL:
      label = i18next.t('label.data-model-plural');
      GroupIcon = IconDashboard;

      break;

    case SearchIndex.SEARCH_INDEX:
      label = i18next.t('label.search-index-plural');
      GroupIcon = SearchOutlined;

      break;

    case SearchIndex.DATA_PRODUCT:
      label = i18next.t('label.data-product-plural');
      GroupIcon = DataProductIcon;

      break;

    default: {
      const { label: indexLabel, GroupIcon: IndexIcon } =
        searchClassBase.getIndexGroupLabel(index);

      label = indexLabel;
      GroupIcon = IndexIcon;

      break;
    }
  }

  const groupLabel = (
    <div className="d-flex items-center p-y-xs">
      <GroupIcon className="m-r-sm" height={16} width={16} />
      <p className="text-grey-muted text-xs">{label}</p>
    </div>
  );

  return groupLabel;
};

export const getSuggestionElement = (
  suggestion: SearchSuggestions[number],
  index: string,
  onClickHandler?: () => void
) => {
  const entitySource = suggestion as SearchSourceAlias;
  const { fullyQualifiedName: fqdn = '', name, serviceType = '' } = suggestion;
  let database;
  let schema;
  if (index === SearchIndex.TABLE) {
    database = getPartialNameFromTableFQN(fqdn, [FqnPart.Database]);
    schema = getPartialNameFromTableFQN(fqdn, [FqnPart.Schema]);
  }

  const entityLink = searchClassBase.getEntityLink(entitySource);
  const dataTestId = `${getPartialNameFromTableFQN(fqdn, [
    FqnPart.Service,
  ])}-${name}`.replaceAll(`"`, '');

  const displayText =
    database && schema
      ? `${database}${FQN_SEPARATOR_CHAR}${schema}${FQN_SEPARATOR_CHAR}${name}`
      : searchClassBase.getEntityName(entitySource);

  const retn = (
    <Button
      block
      className="text-left truncate p-0"
      data-testid={dataTestId}
      icon={
        <img
          alt={serviceType}
          className="m-r-sm"
          height="16px"
          src={serviceUtilClassBase.getServiceTypeLogo(suggestion)}
          width="16px"
        />
      }
      key={fqdn}
      type="text">
      <Link
        className="text-sm"
        data-testid="data-name"
        id={fqdn.replace(/\./g, '')}
        target={searchClassBase.getSearchEntityLinkTarget(entitySource)}
        to={entityLink}
        onClick={onClickHandler}>
        {displayText}
      </Link>
    </Button>
  );

  return retn;
};

export const filterOptionsByIndex = (
  options: Array<Option>,
  searchIndex: SearchIndex,
  maxItemsPerType = 5
) =>
  options
    .filter((option) => option._index === searchIndex)
    .map((option) => option._source)
    .slice(0, maxItemsPerType);

export const getEntityTypeFromSearchIndex = (searchIndex: string) => {
  const commonAssets: Record<string, EntityType> = {
    [SearchIndex.TABLE]: EntityType.TABLE,
    [SearchIndex.PIPELINE]: EntityType.PIPELINE,
    [SearchIndex.DASHBOARD]: EntityType.DASHBOARD,
    [SearchIndex.MLMODEL]: EntityType.MLMODEL,
    [SearchIndex.TOPIC]: EntityType.TOPIC,
    [SearchIndex.CONTAINER]: EntityType.CONTAINER,
    [SearchIndex.STORED_PROCEDURE]: EntityType.STORED_PROCEDURE,
    [SearchIndex.DASHBOARD_DATA_MODEL]: EntityType.DASHBOARD_DATA_MODEL,
    [SearchIndex.SEARCH_INDEX]: EntityType.SEARCH_INDEX,
    [SearchIndex.DATABASE_SCHEMA]: EntityType.DATABASE_SCHEMA,
    [SearchIndex.DATABASE_SERVICE]: EntityType.DATABASE_SERVICE,
    [SearchIndex.MESSAGING_SERVICE]: EntityType.MESSAGING_SERVICE,
    [SearchIndex.DASHBOARD_SERVICE]: EntityType.DASHBOARD_SERVICE,
    [SearchIndex.PIPELINE_SERVICE]: EntityType.PIPELINE_SERVICE,
    [SearchIndex.ML_MODEL_SERVICE]: EntityType.MLMODEL_SERVICE,
    [SearchIndex.STORAGE_SERVICE]: EntityType.STORAGE_SERVICE,
    [SearchIndex.SEARCH_SERVICE]: EntityType.SEARCH_SERVICE,
    [SearchIndex.GLOSSARY_TERM]: EntityType.GLOSSARY_TERM,
    [SearchIndex.TAG]: EntityType.TAG,
    [SearchIndex.DATABASE]: EntityType.DATABASE,
    [SearchIndex.DOMAIN]: EntityType.DOMAIN,
    [SearchIndex.DATA_PRODUCT]: EntityType.DATA_PRODUCT,
  };

  return commonAssets[searchIndex] || null; // Return null if not found
};
