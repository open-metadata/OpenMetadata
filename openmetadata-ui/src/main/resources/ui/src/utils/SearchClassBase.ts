/*
 *  Copyright 2023 Collate.
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
import i18next from 'i18next';
import { ReactComponent as IconTable } from '../assets/svg/table-grey.svg';
import {
  Option,
  SearchSuggestions,
} from '../components/GlobalSearchProvider/GlobalSearchSuggestions/GlobalSearchSuggestions.interface';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import {
  COMMON_DROPDOWN_ITEMS,
  CONTAINER_DROPDOWN_ITEMS,
  DASHBOARD_DATA_MODEL_TYPE,
  DASHBOARD_DROPDOWN_ITEMS,
  DATA_PRODUCT_DROPDOWN_ITEMS,
  GLOSSARY_DROPDOWN_ITEMS,
  PIPELINE_DROPDOWN_ITEMS,
  SEARCH_INDEX_DROPDOWN_ITEMS,
  TABLE_DROPDOWN_ITEMS,
  TAG_DROPDOWN_ITEMS,
  TOPIC_DROPDOWN_ITEMS,
} from '../constants/AdvancedSearch.constants';
import {
  entitySortingFields,
  INITIAL_SORT_FIELD,
  tableSortingFields,
} from '../constants/explore.constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { SearchSourceAlias } from '../interface/search.interface';
import {
  getEntityBreadcrumbs,
  getEntityLinkFromType,
  getEntityName,
} from './EntityUtils';
import i18n from './i18next/LocalUtil';
import { Icons } from './SvgUtils';
import { getServiceIcon } from './TableUtils';

class SearchClassBase {
  public getTabsInfo() {
    return {
      [SearchIndex.TABLE]: {
        label: i18n.t('label.table-plural'),
        sortingFields: tableSortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'tables',
        icon: Icons.TABLE_GREY,
        selectedIcon: Icons.TABLE,
      },
      [SearchIndex.STORED_PROCEDURE]: {
        label: i18n.t('label.stored-procedure-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'storedProcedure',
      },
      [SearchIndex.DATABASE]: {
        label: i18n.t('label.database-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'databases',
      },
      [SearchIndex.DATABASE_SCHEMA]: {
        label: i18n.t('label.database-schema'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'databaseSchemas',
      },
      [SearchIndex.DASHBOARD]: {
        label: i18n.t('label.dashboard-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'dashboards',
        icon: Icons.DASHBOARD_GREY,
        selectedIcon: Icons.DASHBOARD,
      },
      [SearchIndex.DASHBOARD_DATA_MODEL]: {
        label: i18n.t('label.dashboard-data-model-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'dashboardDataModel',
      },
      [SearchIndex.PIPELINE]: {
        label: i18n.t('label.pipeline-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'pipelines',
        icon: Icons.PIPELINE_GREY,
        selectedIcon: Icons.PIPELINE,
      },
      [SearchIndex.TOPIC]: {
        label: i18n.t('label.topic-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'topics',
        icon: Icons.TOPIC_GREY,
        selectedIcon: Icons.TOPIC,
      },
      [SearchIndex.MLMODEL]: {
        label: i18n.t('label.ml-model-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'mlmodels',
      },
      [SearchIndex.CONTAINER]: {
        label: i18n.t('label.container-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'containers',
      },
      [SearchIndex.SEARCH_INDEX]: {
        label: i18n.t('label.search-index-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'searchIndexes',
      },
      [SearchIndex.GLOSSARY]: {
        label: i18n.t('label.glossary-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'glossaries',
      },
      [SearchIndex.TAG]: {
        label: i18n.t('label.tag-plural'),
        sortingFields: entitySortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'tags',
      },
      [SearchIndex.DATA_PRODUCT]: {
        label: i18n.t('label.data-product-plural'),
        sortingFields: tableSortingFields,
        sortField: INITIAL_SORT_FIELD,
        path: 'dataProducts',
      },
    };
  }
  public getDropDownItems(index: string) {
    switch (index) {
      case SearchIndex.TABLE:
        return [...COMMON_DROPDOWN_ITEMS, ...TABLE_DROPDOWN_ITEMS];

      case SearchIndex.TOPIC:
        return [...COMMON_DROPDOWN_ITEMS, ...TOPIC_DROPDOWN_ITEMS];

      case SearchIndex.DASHBOARD:
        return [...COMMON_DROPDOWN_ITEMS, ...DASHBOARD_DROPDOWN_ITEMS];

      case SearchIndex.PIPELINE:
        return [...COMMON_DROPDOWN_ITEMS, ...PIPELINE_DROPDOWN_ITEMS];

      case SearchIndex.SEARCH_INDEX:
        return [...COMMON_DROPDOWN_ITEMS, ...SEARCH_INDEX_DROPDOWN_ITEMS];

      case SearchIndex.MLMODEL:
        return [
          ...COMMON_DROPDOWN_ITEMS.filter(
            (item) => item.key !== 'service_type'
          ),
        ];
      case SearchIndex.CONTAINER:
        return [...COMMON_DROPDOWN_ITEMS, ...CONTAINER_DROPDOWN_ITEMS];
      case SearchIndex.STORED_PROCEDURE:
        return [...COMMON_DROPDOWN_ITEMS];
      case SearchIndex.DASHBOARD_DATA_MODEL:
        return [...COMMON_DROPDOWN_ITEMS, ...DASHBOARD_DATA_MODEL_TYPE];
      case SearchIndex.GLOSSARY:
        return [...GLOSSARY_DROPDOWN_ITEMS];
      case SearchIndex.TAG:
        return [...TAG_DROPDOWN_ITEMS];
      case SearchIndex.DATA_PRODUCT:
        return [...DATA_PRODUCT_DROPDOWN_ITEMS];

      default:
        return [];
    }
  }

  public getListOfEntitiesWithoutTier() {
    return [EntityType.GLOSSARY_TERM, EntityType.TAG, EntityType.DATA_PRODUCT];
  }

  public getServiceIcon(source: SearchSourceAlias) {
    return getServiceIcon(source);
  }

  public getListOfEntitiesWithoutDomain(): string[] {
    return [];
  }

  public getEntityBreadcrumbs(
    entity: SearchSourceAlias,
    entityType?: EntityType,
    includeCurrent?: boolean
  ) {
    return getEntityBreadcrumbs(entity, entityType, includeCurrent);
  }

  public getEntityLink(
    entity: SearchSourceAlias
  ): string | { pathname: string } {
    if (entity.fullyQualifiedName && entity.entityType) {
      return getEntityLinkFromType(
        entity.fullyQualifiedName,
        entity.entityType as EntityType
      );
    }

    return '';
  }

  public getEntityName(entity: SearchSourceAlias) {
    return getEntityName(entity);
  }

  public getSearchEntityLinkTarget(
    _source: SearchSourceAlias,
    openEntityInNewPage?: boolean
  ) {
    return openEntityInNewPage ? '_blank' : '_self';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getEntitySummaryComponent(_entity: SourceType): JSX.Element | null {
    return null;
  }

  public getEntitiesSuggestions(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: Array<Option>
  ): Array<{ suggestions: SearchSuggestions; searchIndex: SearchIndex }> {
    return [];
  }

  public getIndexGroupLabel(index: string) {
    switch (index) {
      case SearchIndex.TABLE:
      default:
        return {
          label: i18next.t('label.table-plural'),
          GroupIcon: IconTable,
        };
    }
  }
}

const searchClassBase = new SearchClassBase();

export default searchClassBase;

export { SearchClassBase };
