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

import Icon, { CloseCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  ListValues,
  OldJsonTree,
  RenderSettings,
  Utils as QbUtils,
} from '@react-awesome-query-builder/antd';
import { Button, Checkbox, MenuProps, Space, Typography } from 'antd';
import { isArray, isEmpty, toLower } from 'lodash';
import React from 'react';
import { ReactComponent as IconDeleteColored } from '../assets/svg/ic-delete-colored.svg';
import ProfilePicture from '../components/common/ProfilePicture/ProfilePicture';
import { SearchOutputType } from '../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { AssetsOfEntity } from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import {
  COMMON_DROPDOWN_ITEMS,
  DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS,
  GLOSSARY_ASSETS_DROPDOWN_ITEMS,
  LINEAGE_DROPDOWN_ITEMS,
} from '../constants/AdvancedSearch.constants';
import { NOT_INCLUDE_AGGREGATION_QUICK_FILTER } from '../constants/explore.constants';
import {
  EntityFields,
  EntityReferenceFields,
} from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import {
  Bucket,
  ContainerSearchSource,
  DashboardSearchSource,
  ExploreSearchSource,
  MlmodelSearchSource,
  PipelineSearchSource,
  SuggestOption,
  TableSearchSource,
  TopicSearchSource,
} from '../interface/search.interface';
import { getTags } from '../rest/tagAPI';
import { getCountBadge } from '../utils/CommonUtils';
import advancedSearchClassBase from './AdvancedSearchClassBase';
import { getEntityName } from './EntityUtils';
import { t } from './i18next/LocalUtil';
import jsonLogicSearchClassBase from './JSONLogicSearchClassBase';
import searchClassBase from './SearchClassBase';

export const getDropDownItems = (index: string) => {
  return searchClassBase.getDropDownItems(index);
};

export const getAssetsPageQuickFilters = (type?: AssetsOfEntity) => {
  switch (type) {
    case AssetsOfEntity.DOMAIN:
    case AssetsOfEntity.DATA_PRODUCT:
      return [...DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS];

    case AssetsOfEntity.GLOSSARY:
      return [...GLOSSARY_ASSETS_DROPDOWN_ITEMS];
    case AssetsOfEntity.LINEAGE:
      return [...LINEAGE_DROPDOWN_ITEMS];
    default:
      return [...COMMON_DROPDOWN_ITEMS];
  }
  // TODO: Add more quick filters
};

export const renderAdvanceSearchButtons: RenderSettings['renderButton'] = (
  props
) => {
  const type = props?.type;

  if (type === 'delRule') {
    return (
      <Icon
        className="action action--DELETE"
        component={
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          CloseCircleOutlined as React.ForwardRefExoticComponent<any>
        }
        data-testid="advanced-search-delete-rule"
        onClick={props?.onClick}
      />
    );
  } else if (type === 'addRule') {
    return (
      <Button
        ghost
        className="action action--ADD-RULE"
        data-testid="advanced-search-add-rule"
        icon={<PlusOutlined />}
        type="primary"
        onClick={props?.onClick}>
        {t('label.add')}
      </Button>
    );
  } else if (type === 'addGroup') {
    return (
      <Button
        className="action action--ADD-GROUP"
        data-testid="advanced-search-add-group"
        icon={<PlusOutlined />}
        type="primary"
        onClick={props?.onClick}>
        {t('label.add')}
      </Button>
    );
  } else if (type === 'delGroup') {
    return (
      <Icon
        alt={t('label.delete-entity', {
          entity: t('label.group'),
        })}
        className="action action--DELETE cursor-pointer align-middle"
        component={IconDeleteColored}
        data-testid="advanced-search-delete-group"
        style={{ fontSize: '16px' }}
        onClick={props?.onClick as () => void}
      />
    );
  }

  return <></>;
};

export const getSearchLabel = (itemLabel: string, searchKey: string) => {
  const regex = new RegExp(searchKey, 'gi');
  if (searchKey) {
    const result = itemLabel.replace(regex, (match) => `<mark>${match}</mark>`);

    return result;
  } else {
    return itemLabel;
  }
};

export const generateSearchDropdownLabel = (
  option: SearchDropdownOption,
  checked: boolean,
  searchKey: string,
  showProfilePicture: boolean,
  hideCounts = false
) => {
  return (
    <div className="d-flex justify-between">
      <Space
        align="center"
        className="m-x-sm"
        data-testid={option.key}
        size={8}>
        <Checkbox checked={checked} data-testid={`${option.key}-checkbox`} />
        {showProfilePicture && (
          <ProfilePicture
            displayName={option.label}
            name={option.label || ''}
            width="18"
          />
        )}
        <Typography.Text
          ellipsis
          className="dropdown-option-label"
          title={option.label}>
          <span
            dangerouslySetInnerHTML={{
              __html: getSearchLabel(option.label, searchKey),
            }}
          />
        </Typography.Text>
      </Space>
      {!hideCounts && getCountBadge(option.count, 'm-r-sm', false)}
    </div>
  );
};

export const getSearchDropdownLabels = (
  optionsArray: SearchDropdownOption[],
  checked: boolean,
  searchKey = '',
  showProfilePicture = false,
  hideCounts = false
): MenuProps['items'] => {
  if (isArray(optionsArray)) {
    const sortedOptions = optionsArray.sort(
      (a, b) => (b.count ?? 0) - (a.count ?? 0)
    );

    return sortedOptions.map((option) => ({
      key: option.key,
      label: generateSearchDropdownLabel(
        option,
        checked,
        searchKey,
        showProfilePicture,
        hideCounts
      ),
    }));
  } else {
    return [];
  }
};

export const getSelectedOptionLabelString = (
  selectedOptions: SearchDropdownOption[],
  showAllOptions = false
) => {
  if (isArray(selectedOptions)) {
    const stringifiedOptions = selectedOptions.map((op) => op.label).join(', ');
    if (stringifiedOptions.length < 15 || showAllOptions) {
      return stringifiedOptions;
    } else {
      return `${stringifiedOptions.slice(0, 11)}...`;
    }
  } else {
    return '';
  }
};

export const getChartsOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const chartRef = (
    option as SuggestOption<SearchIndex.DASHBOARD, DashboardSearchSource>
  )._source.charts?.find(
    (chart) => chart.displayName === option.text || chart.name === option.text
  );

  const entityName = getEntityName(chartRef);

  return isEmpty(entityName) ? option.text : entityName;
};

export const getDataModelOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const chartRef = (
    option as SuggestOption<SearchIndex.DASHBOARD, DashboardSearchSource>
  )._source.dataModels?.find(
    (dataModel) =>
      dataModel.displayName === option.text || dataModel.name === option.text
  );

  const entityName = getEntityName(chartRef);

  return isEmpty(entityName) ? option.text : entityName;
};

export const getTasksOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const taskRef = (
    option as SuggestOption<SearchIndex.PIPELINE, PipelineSearchSource>
  )._source.tasks?.find(
    (task) => task.displayName === option.text || task.name === option.text
  );

  const entityName = getEntityName(taskRef);

  return isEmpty(entityName) ? option.text : entityName;
};

export const getColumnsOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>,
  index: SearchIndex
) => {
  if (index === SearchIndex.TABLE) {
    const columnRef = (
      option as SuggestOption<SearchIndex.TABLE, TableSearchSource>
    )._source.columns.find(
      (column) =>
        column.displayName === option.text || column.name === option.text
    );

    const entityName = getEntityName(columnRef);

    return isEmpty(entityName) ? option.text : entityName;
  } else {
    const dataModel = (
      option as SuggestOption<SearchIndex.CONTAINER, ContainerSearchSource>
    )._source.dataModel;
    const columnRef = dataModel
      ? dataModel.columns.find(
          (column) =>
            column.displayName === option.text || column.name === option.text
        )
      : undefined;

    const entityName = getEntityName(columnRef);

    return isEmpty(entityName) ? option.text : entityName;
  }
};

export const getSchemaFieldOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const schemaFields = (
    option as SuggestOption<SearchIndex.TOPIC, TopicSearchSource>
  )._source.messageSchema?.schemaFields;

  const schemaRef = schemaFields
    ? schemaFields.find(
        (field) =>
          field.displayName === option.text || field.name === option.text
      )
    : undefined;

  const entityName = getEntityName(schemaRef);

  return isEmpty(entityName) ? option.text : entityName;
};

export const getServiceOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const service = (
    option as SuggestOption<
      SearchIndex,
      | TableSearchSource
      | DashboardSearchSource
      | PipelineSearchSource
      | MlmodelSearchSource
      | TopicSearchSource
    >
  )._source.service;

  return service
    ? service.displayName ?? service.name ?? option.text
    : option.text;
};

export const getOptionsFromAggregationBucket = (buckets: Bucket[]) => {
  if (!buckets) {
    return [];
  }

  return buckets
    .filter(
      (item) =>
        !NOT_INCLUDE_AGGREGATION_QUICK_FILTER.includes(item.key as EntityType)
    )
    .map((option) => ({
      key: option.key,
      label: option.key,
      count: option.doc_count ?? 0,
    }));
};

export const getTierOptions = async (): Promise<ListValues> => {
  try {
    const { data: tiers } = await getTags({
      parent: 'Tier',
      limit: 50,
    });

    const tierFields = tiers.map((tier) => ({
      title: tier.fullyQualifiedName, // tier.name,
      value: tier.fullyQualifiedName,
    }));

    return tierFields as ListValues;
  } catch (error) {
    return [];
  }
};

export const getTreeConfig = ({
  searchOutputType,
  searchIndex,
  isExplorePage,
  tierOptions,
}: {
  searchOutputType: SearchOutputType;
  searchIndex: SearchIndex | SearchIndex[];
  tierOptions: Promise<ListValues>;
  isExplorePage: boolean;
}) => {
  const index = isArray(searchIndex) ? searchIndex : [searchIndex];

  return searchOutputType === SearchOutputType.ElasticSearch
    ? advancedSearchClassBase.getQbConfigs(tierOptions, index, isExplorePage)
    : jsonLogicSearchClassBase.getQbConfigs(tierOptions, index, isExplorePage);
};

export const formatQueryValueBasedOnType = (
  value: string[],
  field: string,
  type: string
) => {
  if (field.includes('extension') && type === 'text') {
    return value.map((item) => toLower(item));
  }

  return value;
};

export const getCustomPropertyAdvanceSearchEnumOptions = (
  enumValues: string[]
) => {
  return enumValues.reduce((acc: Record<string, string>, value) => {
    acc[value] = value;

    return acc;
  }, {});
};

export const getEmptyJsonTree = (
  defaultField: string = EntityFields.OWNERS
): OldJsonTree => {
  return {
    id: QbUtils.uuid(),
    type: 'group',
    properties: {
      conjunction: 'AND',
      not: false,
    },
    children1: {
      [QbUtils.uuid()]: {
        type: 'group',
        properties: {
          conjunction: 'AND',
          not: false,
        },
        children1: {
          [QbUtils.uuid()]: {
            type: 'rule',
            properties: {
              field: defaultField,
              operator: null,
              value: [],
              valueSrc: ['value'],
            },
          },
        },
      },
    },
  };
};

/**
 * Creates an empty JSON tree structure specifically optimized for QueryBuilderWidget
 * This structure allows easy addition of groups and rules
 */
export const getEmptyJsonTreeForQueryBuilder = (
  defaultField: string = EntityReferenceFields.OWNERS
): OldJsonTree => {
  const uuid1 = QbUtils.uuid();
  const uuid2 = QbUtils.uuid();
  const uuid3 = QbUtils.uuid();

  return {
    id: uuid1,
    type: 'group',
    properties: {
      conjunction: 'AND',
      not: false,
    },
    children1: {
      [uuid2]: {
        type: 'rule_group',
        id: uuid2,
        properties: {
          conjunction: 'AND',
          not: false,
          mode: 'some',
          field: defaultField,
          fieldSrc: 'field',
        },
        children1: {
          [uuid3]: {
            type: 'rule',
            id: uuid3,
            properties: {
              field: 'glossaryTerm.glossaryTermFQN',
              operator: 'select_equals',
              value: [],
              valueSrc: ['value'],
              fieldSrc: 'field',
            },
          },
        },
      },
    },
  };
};
