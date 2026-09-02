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

type SearchIndexGroupConfig = {
  labelKey: string;
  entityType?: EntityType;
};

const SEARCH_INDEX_GROUP_CONFIG: Record<string, SearchIndexGroupConfig> = {
  [SearchIndex.TOPIC]: {
    labelKey: 'label.topic-plural',
    entityType: EntityType.TOPIC,
  },
  [SearchIndex.DATABASE]: {
    labelKey: 'label.database-plural',
    entityType: EntityType.DATABASE,
  },
  [SearchIndex.DATABASE_SCHEMA]: {
    labelKey: 'label.database-schema-plural',
    entityType: EntityType.DATABASE_SCHEMA,
  },
  [SearchIndex.DASHBOARD]: {
    labelKey: 'label.dashboard-plural',
    entityType: EntityType.DASHBOARD,
  },
  [SearchIndex.PIPELINE]: {
    labelKey: 'label.pipeline-plural',
    entityType: EntityType.PIPELINE,
  },
  [SearchIndex.MLMODEL]: {
    labelKey: 'label.ml-model-plural',
    entityType: EntityType.MLMODEL,
  },
  [SearchIndex.GLOSSARY_TERM]: {
    labelKey: 'label.glossary-term-plural',
    entityType: EntityType.GLOSSARY_TERM,
  },
  [SearchIndex.TAG]: {
    labelKey: 'label.tag-plural',
    entityType: EntityType.TAG,
  },
  [SearchIndex.CONTAINER]: {
    labelKey: 'label.container-plural',
    entityType: EntityType.CONTAINER,
  },
  [SearchIndex.STORED_PROCEDURE]: {
    labelKey: 'label.stored-procedure-plural',
    entityType: EntityType.STORED_PROCEDURE,
  },
  [SearchIndex.DASHBOARD_DATA_MODEL]: {
    labelKey: 'label.data-model-plural',
    entityType: EntityType.DASHBOARD_DATA_MODEL,
  },
  [SearchIndex.SEARCH_INDEX]: {
    labelKey: 'label.search-index-plural',
  },
  [SearchIndex.DATA_PRODUCT]: {
    labelKey: 'label.data-product-plural',
    entityType: EntityType.DATA_PRODUCT,
  },
  [SearchIndex.CHART]: {
    labelKey: 'label.chart-plural',
    entityType: EntityType.CHART,
  },
  [SearchIndex.API_COLLECTION]: {
    labelKey: 'label.api-collection-plural',
    entityType: EntityType.API_COLLECTION,
  },
  [SearchIndex.API_ENDPOINT]: {
    labelKey: 'label.api-endpoint-plural',
    entityType: EntityType.API_ENDPOINT,
  },
  [SearchIndex.METRIC]: {
    labelKey: 'label.metric-plural',
    entityType: EntityType.METRIC,
  },
  [SearchIndex.DIRECTORY]: {
    labelKey: 'label.directory-plural',
    entityType: EntityType.DIRECTORY,
  },
  [SearchIndex.FILE]: {
    labelKey: 'label.file-plural',
    entityType: EntityType.FILE,
  },
  [SearchIndex.SPREADSHEET]: {
    labelKey: 'label.spreadsheet-plural',
    entityType: EntityType.SPREADSHEET,
  },
  [SearchIndex.WORKSHEET]: {
    labelKey: 'label.worksheet-plural',
    entityType: EntityType.WORKSHEET,
  },
  [SearchIndex.COLUMN]: {
    labelKey: 'label.column-plural',
    entityType: EntityType.TABLE_COLUMN,
  },
  [SearchIndex.KNOWLEDGE_PAGE_INDEX]: {
    labelKey: 'label.context-center',
    entityType: EntityType.KNOWLEDGE_CENTER,
  },
};

export const getGroupLabel = (index: string) => {
  const config = SEARCH_INDEX_GROUP_CONFIG[index];

  let label: string;
  let GroupIcon;

  if (config) {
    label = i18n.t(config.labelKey);
    GroupIcon = config.entityType
      ? ENTITY_ICON_MAPPER[config.entityType].icon
      : SearchOutlined;
  } else {
    const { label: indexLabel, GroupIcon: IndexIcon } =
      searchClassBase.getIndexGroupLabel(index);

    label = indexLabel;
    GroupIcon = IndexIcon;
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
