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

import { Button, Tooltip } from 'antd';
import { FqnPart } from 'enums/entity.enum';
import i18next from 'i18next';
import { isEmpty } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Option,
  SearchSuggestions,
} from '../components/GlobalSearchProvider/GlobalSearchSuggestions/GlobalSearchSuggestions.interface';
import {
  FQN_SEPARATOR_CHAR,
  WILD_CARD_CHAR,
} from '../constants/char.constants';
import { SearchIndex } from '../enums/search.enum';
import { getPartialNameFromTableFQN } from './CommonUtils';
import { serviceTypeLogo } from './ServiceUtils';
import SVGIcons, { Icons } from './SvgUtils';
import { getEntityLink } from './TableUtils';

export const getSearchAPIQueryParams = (
  queryString: string,
  from: number,
  size: number,
  filters: string,
  sortField: string,
  sortOrder: string,
  searchIndex: SearchIndex | SearchIndex[],
  onlyDeleted = false,
  trackTotalHits = false
): Record<string, string | boolean | number | string[]> => {
  const start = (from - 1) * size;
  const query =
    queryString && queryString === WILD_CARD_CHAR
      ? queryString
      : `*${queryString}*`;

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
  let icon = '';
  switch (index) {
    case SearchIndex.TOPIC:
      label = i18next.t('label.topic-plural');
      icon = Icons.TOPIC_GREY;

      break;
    case SearchIndex.DASHBOARD:
      label = i18next.t('label.dashboard-plural');
      icon = Icons.DASHBOARD_GREY;

      break;
    case SearchIndex.PIPELINE:
      label = i18next.t('label.pipeline-plural');
      icon = Icons.PIPELINE_GREY;

      break;
    case SearchIndex.MLMODEL:
      label = i18next.t('label.ml-model-plural');
      icon = Icons.MLMODAL;

      break;
    case SearchIndex.GLOSSARY:
      label = i18next.t('label.glossary-term-plural');
      icon = Icons.FLAT_FOLDER;

      break;
    case SearchIndex.TAG:
      label = i18next.t('label.tag-plural');
      icon = Icons.TAG_GREY;

      break;
    case SearchIndex.CONTAINER:
      label = i18next.t('label.container-plural');
      icon = Icons.CONTAINER;

      break;

    case SearchIndex.TABLE:
    default:
      label = i18next.t('label.table-plural');
      icon = Icons.TABLE_GREY;

      break;
  }

  const groupLabel = (
    <div className="d-flex items-center p-y-xs">
      <SVGIcons alt="icon" className="m-r-sm" icon={icon} />
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
  const { fullyQualifiedName: fqdn = '', name, serviceType = '' } = suggestion;
  let database;
  let schema;
  if (index === SearchIndex.TABLE) {
    database = getPartialNameFromTableFQN(fqdn, [FqnPart.Database]);
    schema = getPartialNameFromTableFQN(fqdn, [FqnPart.Schema]);
  }

  const entityLink = getEntityLink(index, fqdn);
  const dataTestId = `${getPartialNameFromTableFQN(fqdn, [
    FqnPart.Service,
  ])}-${name}`.replaceAll(`"`, '');

  const displayText =
    database && schema
      ? `${database}${FQN_SEPARATOR_CHAR}${schema}${FQN_SEPARATOR_CHAR}${name}`
      : name;

  const retn = (
    <Tooltip title={displayText}>
      <Button
        block
        className="text-left truncate p-0"
        data-testid={dataTestId}
        icon={
          <img
            alt={serviceType}
            className="m-r-sm"
            height="16px"
            src={serviceTypeLogo(serviceType)}
            width="16px"
          />
        }
        key={fqdn}
        type="text">
        <Link
          className="text-sm"
          data-testid="data-name"
          id={fqdn.replace(/\./g, '')}
          to={entityLink}
          onClick={onClickHandler}>
          {displayText}
        </Link>
      </Button>
    </Tooltip>
  );

  return retn;
};

export const filterOptionsByIndex = (
  options: Array<Option>,
  searchIndex: SearchIndex,
  maxItemsPerType = 3
) =>
  options
    .filter((option) => option._index === searchIndex)
    .map((option) => option._source)
    .slice(0, maxItemsPerType);
