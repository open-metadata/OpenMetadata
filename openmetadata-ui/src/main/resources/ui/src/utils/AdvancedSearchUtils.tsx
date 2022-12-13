/*
 *  Copyright 2021 Collate
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
import { isArray, isUndefined } from 'lodash';
import React from 'react';
import { RenderSettings } from 'react-awesome-query-builder';
import {
  ALL_DROPDOWN_ITEMS,
  COMMON_DROPDOWN_ITEMS,
  DASHBOARD_DROPDOWN_ITEMS,
  PIPELINE_DROPDOWN_ITEMS,
  TABLE_DROPDOWN_ITEMS,
} from '../constants/AdvancedSearch.constants';

import { AdvancedFields } from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import SVGIcons, { Icons } from './SvgUtils';

export const getDropDownItems = (index: string) => {
  switch (index) {
    case SearchIndex.TABLE:
      return [...TABLE_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.TOPIC:
      return [...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.DASHBOARD:
      return [...DASHBOARD_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.PIPELINE:
      return [...PIPELINE_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.MLMODEL:
      return [
        ...COMMON_DROPDOWN_ITEMS.filter((item) => item.key !== 'service_type'),
      ];

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
      return AdvancedFields.COLUMN;

    case 'databaseSchema.name':
      return AdvancedFields.SCHEMA;

    case 'database.name':
      return AdvancedFields.DATABASE;

    case 'charts.displayName':
      return AdvancedFields.CHART;

    case 'tasks.displayName':
      return AdvancedFields.TASK;

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
        alt={i18next.t('label.delete-group')}
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

export const getSearchDropdownLabels = (
  optionsArray: string[],
  checked: boolean
): MenuProps['items'] => {
  if (isArray(optionsArray)) {
    return optionsArray.map((option) => ({
      key: option,
      label: (
        <Space className="m-x-sm" data-testid={option} size={6}>
          <Checkbox checked={checked} data-testid={`${option}-checkbox`} />
          <Typography.Text
            ellipsis
            className="dropdown-option-label"
            title={option}>
            {option}
          </Typography.Text>
        </Space>
      ),
    }));
  } else {
    return [];
  }
};

export const getSelectedOptionLabelString = (selectedOptions: string[]) => {
  if (isArray(selectedOptions)) {
    const stringifiedOptions = selectedOptions.join(', ');
    if (stringifiedOptions.length < 15) {
      return stringifiedOptions;
    } else {
      return `${stringifiedOptions.slice(0, 11)}...`;
    }
  } else {
    return '';
  }
};
