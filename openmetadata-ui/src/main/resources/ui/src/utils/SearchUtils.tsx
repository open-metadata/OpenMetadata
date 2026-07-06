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
import { Button, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { ENTITY_ICON_MAPPER } from '../constants/Assets.constants';
import {
  Option,
  SearchSuggestions,
} from '../context/GlobalSearchProvider/GlobalSearchSuggestions/GlobalSearchSuggestions.interface';
import { EntityType, FqnPart } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { SearchSourceAlias } from '../interface/search.interface';
import { getPartialNameFromTableFQN } from './FqnUtils';
import i18n from './i18next/LocalUtil';
import searchClassBase from './SearchClassBase';
import serviceUtilClassBase from './ServiceUtilClassBase';

export const getGroupLabel = (index: string) => {
  let label = '';
  let GroupIcon;
  switch (index) {
    case SearchIndex.TOPIC:
      label = i18n.t('label.topic-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.TOPIC].icon;

      break;
    case SearchIndex.DATABASE:
      label = i18n.t('label.database-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.DATABASE].icon;

      break;
    case SearchIndex.DATABASE_SCHEMA:
      label = i18n.t('label.database-schema-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.DATABASE_SCHEMA].icon;

      break;
    case SearchIndex.DASHBOARD:
      label = i18n.t('label.dashboard-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.DASHBOARD].icon;

      break;
    case SearchIndex.PIPELINE:
      label = i18n.t('label.pipeline-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.PIPELINE].icon;

      break;
    case SearchIndex.MLMODEL:
      label = i18n.t('label.ml-model-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.MLMODEL].icon;

      break;
    case SearchIndex.GLOSSARY_TERM:
      label = i18n.t('label.glossary-term-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.GLOSSARY_TERM].icon;

      break;
    case SearchIndex.TAG:
      label = i18n.t('label.tag-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.TAG].icon;

      break;
    case SearchIndex.CONTAINER:
      label = i18n.t('label.container-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.CONTAINER].icon;

      break;

    case SearchIndex.STORED_PROCEDURE:
      label = i18n.t('label.stored-procedure-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.STORED_PROCEDURE].icon;

      break;

    case SearchIndex.DASHBOARD_DATA_MODEL:
      label = i18n.t('label.data-model-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.DASHBOARD_DATA_MODEL].icon;

      break;

    case SearchIndex.SEARCH_INDEX:
      label = i18n.t('label.search-index-plural');
      GroupIcon = SearchOutlined;

      break;

    case SearchIndex.DATA_PRODUCT:
      label = i18n.t('label.data-product-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.DATA_PRODUCT].icon;

      break;

    case SearchIndex.CHART:
      label = i18n.t('label.chart-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.CHART].icon;

      break;
    case SearchIndex.API_COLLECTION:
      label = i18n.t('label.api-collection-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.API_COLLECTION].icon;

      break;

    case SearchIndex.API_ENDPOINT:
      label = i18n.t('label.api-endpoint-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.API_ENDPOINT].icon;

      break;
    case SearchIndex.METRIC:
      label = i18n.t('label.metric-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.METRIC].icon;

      break;
    case SearchIndex.DIRECTORY:
      label = i18n.t('label.directory-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.DIRECTORY].icon;

      break;
    case SearchIndex.FILE:
      label = i18n.t('label.file-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.FILE].icon;

      break;
    case SearchIndex.SPREADSHEET:
      label = i18n.t('label.spreadsheet-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.SPREADSHEET].icon;

      break;
    case SearchIndex.WORKSHEET:
      label = i18n.t('label.worksheet-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.WORKSHEET].icon;

      break;

    case SearchIndex.COLUMN:
      label = i18n.t('label.column-plural');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.TABLE_COLUMN].icon;

      break;

    case SearchIndex.KNOWLEDGE_PAGE_INDEX:
      label = i18n.t('label.knowledge-center');
      GroupIcon = ENTITY_ICON_MAPPER[EntityType.KNOWLEDGE_CENTER].icon;

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
    <div className="d-flex items-center p-y-xs p-x-lg">
      <GroupIcon className="m-r-sm" height={16} width={16} />
      <p className="text-grey-muted text-xs">{label}</p>
    </div>
  );

  return groupLabel;
};

export const getSuggestionElement = (
  suggestion: SearchSuggestions[number],
  onClickHandler?: () => void
) => {
  const entitySource = suggestion as SearchSourceAlias;
  const { fullyQualifiedName: fqdn = '', name, serviceType = '' } = suggestion;
  const entityLink = searchClassBase.getEntityLink(entitySource);
  const dataTestId = `${getPartialNameFromTableFQN(fqdn, [
    FqnPart.Service,
  ])}-${name}`.replaceAll(`"`, '');

  const displayText = searchClassBase.getEntityName(entitySource);
  const fqn = `(${entitySource.fullyQualifiedName ?? ''})`;

  return (
    <Button
      block
      className="text-left truncate p-y-0 p-x-lg"
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
        className="text-sm no-underline"
        data-testid="data-name"
        id={fqdn.replaceAll('.', '')}
        target={searchClassBase.getSearchEntityLinkTarget(entitySource)}
        to={entityLink}
        onClick={onClickHandler}>
        {displayText}
        <Typography.Text className="m-l-xs text-xs" type="secondary">
          {fqn}
        </Typography.Text>
      </Link>
    </Button>
  );
};

export const filterOptionsByIndex = (
  options: Array<Option>,
  searchIndex: SearchIndex,
  maxItemsPerType = 5
) => {
  const entityType =
    searchClassBase.getSearchIndexEntityTypeMapping()[searchIndex];

  if (!entityType) {
    return [];
  }

  return options
    .filter((option) => option._source?.entityType === entityType)
    .map((option) => option._source)
    .slice(0, maxItemsPerType);
};
