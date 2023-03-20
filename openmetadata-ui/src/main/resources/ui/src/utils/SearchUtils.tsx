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

import { Select } from 'antd';
import { FqnPart } from 'enums/entity.enum';
import i18next from 'i18next';
import { isEmpty } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
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

export const getGroupLabel = (index: string, wrapInSelectOption = false) => {
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
      icon = Icons.TABLE_GREY;

      break;
    case SearchIndex.TAG:
      label = i18next.t('label.tag-plural');
      icon = Icons.TABLE_GREY;

      break;

    case SearchIndex.TABLE:
    default:
      label = i18next.t('label.table-plural');
      icon = Icons.TABLE_GREY;

      break;
  }

  const groupLabel = (
    <div
      className={`d-flex items-center ${!wrapInSelectOption ? 'tw-my-2' : ''}`}>
      <SVGIcons
        alt="icon"
        className={`  ${
          !wrapInSelectOption ? 'tw-w-4 tw-h-4 tw-ml-2' : 'tw-w-3 tw-h-3'
        }`}
        icon={icon}
      />
      <p className="tw-px-2 tw-text-grey-muted tw-text-xs tw-h-4 tw-mb-0">
        {label}
      </p>
    </div>
  );

  if (wrapInSelectOption) {
    return <Select.Option disabled>{groupLabel}</Select.Option>;
  }

  return groupLabel;
};

export const getSuggestionElement = (
  fqdn: string,
  serviceType: string,
  name: string,
  index: string,
  wrapInSelectOption: boolean,
  onClickHandler?: () => void
) => {
  let database;
  let schema;
  if (index === SearchIndex.TABLE) {
    database = getPartialNameFromTableFQN(fqdn, [FqnPart.Database]);
    schema = getPartialNameFromTableFQN(fqdn, [FqnPart.Schema]);
  }

  const entityLink = getEntityLink(index, fqdn);

  const retn = (
    <div
      className="d-flex items-center hover:tw-bg-body-hover"
      data-testid={`${getPartialNameFromTableFQN(fqdn, [
        FqnPart.Service,
      ])}-${name}`}
      key={fqdn}>
      <img
        alt={serviceType}
        className={`inline tw-h-4 ${!wrapInSelectOption ? 'tw-ml-2' : ''}`}
        src={serviceTypeLogo(serviceType)}
      />
      <Link
        className={`tw-text-sm ${
          !wrapInSelectOption ? 'd-block tw-px-4 tw-py-2' : 'tw-px-2'
        }`}
        data-testid="data-name"
        id={fqdn.replace(/\./g, '')}
        to={entityLink}
        onClick={onClickHandler}>
        {database && schema
          ? `${database}${FQN_SEPARATOR_CHAR}${schema}${FQN_SEPARATOR_CHAR}${name}`
          : name}
      </Link>
    </div>
  );

  if (wrapInSelectOption) {
    return (
      <Select.Option key={entityLink} value={entityLink}>
        {retn}
      </Select.Option>
    );
  }

  return retn;
};
