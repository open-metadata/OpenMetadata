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
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import { SearchDropdownOption } from 'components/SearchDropdown/SearchDropdown.interface';
import i18next from 'i18next';
import { isArray, isUndefined } from 'lodash';
import React from 'react';
import { RenderSettings } from 'react-awesome-query-builder';
import {
  ALL_DROPDOWN_ITEMS,
  COMMON_DROPDOWN_ITEMS,
  CONTAINER_DROPDOWN_ITEMS,
  DASHBOARD_DROPDOWN_ITEMS,
  GLOSSARY_DROPDOWN_ITEMS,
  PIPELINE_DROPDOWN_ITEMS,
  TABLE_DROPDOWN_ITEMS,
  TOPIC_DROPDOWN_ITEMS,
} from '../constants/AdvancedSearch.constants';

import { EntityReference as ChartEntityReference } from 'generated/entity/data/dashboard';
import { Column } from 'generated/entity/data/table';
import { Field } from 'generated/entity/data/topic';
import {
  ContainerSearchSource,
  DashboardSearchSource,
  ExploreSearchSource,
  MlmodelSearchSource,
  PipelineSearchSource,
  SuggestOption,
  TableSearchSource,
  TopicSearchSource,
} from 'interface/search.interface';
import { AdvancedFields } from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import { Task } from '../generated/entity/data/pipeline';
import SVGIcons, { Icons } from './SvgUtils';

export const getDropDownItems = (index: string) => {
  switch (index) {
    case SearchIndex.TABLE:
      return [...TABLE_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.TOPIC:
      return [...TOPIC_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.DASHBOARD:
      return [...DASHBOARD_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.PIPELINE:
      return [...PIPELINE_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.MLMODEL:
      return [
        ...COMMON_DROPDOWN_ITEMS.filter((item) => item.key !== 'service_type'),
      ];
    case SearchIndex.CONTAINER:
      return [...CONTAINER_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];
    case SearchIndex.GLOSSARY:
      return [...GLOSSARY_DROPDOWN_ITEMS];

    default:
      return [];
  }
};

export const getItemLabel = (key: string) => {
  const item = ALL_DROPDOWN_ITEMS.find((dItem) => dItem.key === key);

  return !isUndefined(item) ? item.label : 'label';
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

export const getSearchDropdownLabels = (
  optionsArray: SearchDropdownOption[],
  checked: boolean,
  searchKey = '',
  showProfilePicture = false
): MenuProps['items'] => {
  if (isArray(optionsArray)) {
    return optionsArray.map((option) => ({
      key: option.key,
      label: (
        <Space
          align="center"
          className="m-x-sm"
          data-testid={option.key}
          size={8}>
          <Checkbox checked={checked} data-testid={`${option.key}-checkbox`} />
          {showProfilePicture && (
            <ProfilePicture
              displayName={option.label}
              id={option.key || ''}
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

export const getDisplayNameFromEntity = (
  text: string,
  entity?: ChartEntityReference | Task | Column | Field
) => {
  return entity ? entity.displayName ?? entity.name ?? text : text;
};

export const getChartsOptions = (
  op: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const chartRef = (
    op as SuggestOption<SearchIndex.DASHBOARD, DashboardSearchSource>
  )._source.charts?.find(
    (chart) => chart.displayName === op.text || chart.name === op.text
  );

  return getDisplayNameFromEntity(op.text, chartRef);
};

export const getTasksOptions = (
  op: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const taskRef = (
    op as SuggestOption<SearchIndex.PIPELINE, PipelineSearchSource>
  )._source.tasks?.find(
    (task) => task.displayName === op.text || task.name === op.text
  );

  return getDisplayNameFromEntity(op.text, taskRef);
};

export const getColumnsOptions = (
  op: SuggestOption<SearchIndex, ExploreSearchSource>,
  index: SearchIndex
) => {
  if (index === SearchIndex.TABLE) {
    const columnRef = (
      op as SuggestOption<SearchIndex.TABLE, TableSearchSource>
    )._source.columns.find(
      (column) => column.displayName === op.text || column.name === op.text
    );

    return getDisplayNameFromEntity(op.text, columnRef);
  } else {
    const dataModel = (
      op as SuggestOption<SearchIndex.CONTAINER, ContainerSearchSource>
    )._source.dataModel;
    const columnRef = dataModel
      ? dataModel.columns.find(
          (column) => column.displayName === op.text || column.name === op.text
        )
      : undefined;

    return getDisplayNameFromEntity(op.text, columnRef);
  }
};

export const getTopicOptions = (
  op: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const schemaFields = (
    op as SuggestOption<SearchIndex.TOPIC, TopicSearchSource>
  )._source.messageSchema?.schemaFields;

  const schemaRef = schemaFields
    ? schemaFields.find(
        (field) => field.displayName === op.text || field.name === op.text
      )
    : undefined;

  return getDisplayNameFromEntity(op.text, schemaRef);
};

export const getServiceOptions = (
  op: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const service = (
    op as SuggestOption<
      SearchIndex,
      | TableSearchSource
      | DashboardSearchSource
      | PipelineSearchSource
      | MlmodelSearchSource
      | TopicSearchSource
    >
  )._source.service;

  return service ? service.displayName ?? service.name ?? op.text : op.text;
};

// Function to get the display name to show in the options for search Dropdowns
export const getOptionTextFromKey = (
  index: SearchIndex,
  op: SuggestOption<SearchIndex, ExploreSearchSource>,
  key: string
) => {
  switch (key) {
    case 'charts.displayName.keyword': {
      return getChartsOptions(op);
    }
    case 'tasks.displayName.keyword': {
      return getTasksOptions(op);
    }
    case 'columns.name': {
      return getColumnsOptions(op, index);
    }
    case 'service.name': {
      return getServiceOptions(op);
    }
    case 'messageSchema.schemaFields.name': {
      return getTopicOptions(op);
    }
    default: {
      return op.text;
    }
  }
};
