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
import { Button, Checkbox, MenuProps, Space, Typography } from 'antd';
import i18next from 'i18next';
import { isArray, isEmpty } from 'lodash';
import React from 'react';
import { RenderSettings } from 'react-awesome-query-builder';
import ProfilePicture from '../components/common/ProfilePicture/ProfilePicture';
import { AssetsOfEntity } from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import {
  COMMON_DROPDOWN_ITEMS,
  DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS,
  GLOSSARY_ASSETS_DROPDOWN_ITEMS,
} from '../constants/AdvancedSearch.constants';
import { AdvancedFields } from '../enums/AdvancedSearch.enum';
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
import { getCountBadge } from '../utils/CommonUtils';
import { getEntityName } from './EntityUtils';
import searchClassBase from './SearchClassBase';
import SVGIcons, { Icons } from './SvgUtils';

export const getDropDownItems = (index: string) => {
  return searchClassBase.getDropDownItems(index);
};

export const getAssetsPageQuickFilters = (type: AssetsOfEntity) => {
  switch (type) {
    case AssetsOfEntity.DOMAIN:
    case AssetsOfEntity.DATA_PRODUCT:
      return [...DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS];

    case AssetsOfEntity.GLOSSARY:
      return [...GLOSSARY_ASSETS_DROPDOWN_ITEMS];
    default:
      return [...COMMON_DROPDOWN_ITEMS];
  }
  // TODO: Add more quick filters
};

export const getAdvancedField = (field: string) => {
  switch (field) {
    case 'columns.name':
    case 'dataModel.columns.name':
      return AdvancedFields.COLUMN;

    case 'databaseSchema.name':
      return AdvancedFields.SCHEMA;

    case 'database.name':
      return AdvancedFields.DATABASE;

    case 'charts.displayName.keyword':
      return AdvancedFields.CHART;

    case 'dataModels.displayName.keyword':
      return AdvancedFields.DATA_MODEL;

    case 'tasks.displayName.keyword':
      return AdvancedFields.TASK;

    case 'messageSchema.schemaFields.name':
      return AdvancedFields.FIELD;

    case 'service.name':
      return AdvancedFields.SERVICE;

    default:
      return;
  }
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
        onClick={props?.onClick}
      />
    );
  } else if (type === 'addRule') {
    return (
      <Button
        ghost
        className="action action--ADD-RULE"
        icon={<PlusOutlined />}
        type="primary"
        onClick={props?.onClick}>
        {i18next.t('label.add')}
      </Button>
    );
  } else if (type === 'addGroup') {
    return (
      <Button
        className="action action--ADD-GROUP"
        icon={<PlusOutlined />}
        type="primary"
        onClick={props?.onClick}>
        {i18next.t('label.add')}
      </Button>
    );
  } else if (type === 'delGroup') {
    return (
      <SVGIcons
        alt={i18next.t('label.delete-entity', {
          entity: i18next.t('label.group'),
        })}
        className="action action--DELETE cursor-pointer "
        height={16}
        icon={Icons.DELETE_COLORED}
        width={16}
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
  showProfilePicture: boolean
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
            textClass="text-xs"
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
      {getCountBadge(option.count, 'm-r-sm', false)}
    </div>
  );
};

export const getSearchDropdownLabels = (
  optionsArray: SearchDropdownOption[],
  checked: boolean,
  searchKey = '',
  showProfilePicture = false
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
        showProfilePicture
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

// Function to get the display name to show in the options for search Dropdowns
export const getOptionTextFromKey = (
  index: SearchIndex,
  option: SuggestOption<SearchIndex, ExploreSearchSource>,
  key: string
) => {
  switch (key) {
    case 'charts.displayName.keyword': {
      return getChartsOptions(option);
    }
    case 'dataModels.displayName.keyword': {
      return getDataModelOptions(option);
    }
    case 'tasks.displayName.keyword': {
      return getTasksOptions(option);
    }
    case 'columns.name': {
      return getColumnsOptions(option, index);
    }
    case 'service.name': {
      return getServiceOptions(option);
    }
    case 'messageSchema.schemaFields.name': {
      return getSchemaFieldOptions(option);
    }
    default: {
      return option.text;
    }
  }
};

export const getOptionsFromAggregationBucket = (buckets: Bucket[]) => {
  if (!buckets) {
    return [];
  }

  return buckets.map((option) => ({
    key: option.key,
    label: option.key,
    count: option.doc_count ?? 0,
  }));
};
