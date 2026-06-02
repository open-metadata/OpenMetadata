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

export {
  formatQueryValueBasedOnType,
  getAssetsPageQuickFilters,
  getChartsOptions,
  getColumnsOptions,
  getCustomPropertyAdvanceSearchEnumOptions,
  getDataModelOptions,
  getDropDownItems,
  getEmptyJsonTree,
  getEmptyJsonTreeForQueryBuilder,
  getOptionsFromAggregationBucket,
  getSchemaFieldOptions,
  getSearchLabel,
  getSelectedOptionLabelString,
  getServiceOptions,
  getTasksOptions,
  getTierOptions,
  getTreeConfig,
  processCustomPropertyField,
  processEntityTypeFields,
} from './AdvancedSearchPureUtils';

import Icon, { CloseCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';
import { RenderSettings } from '@react-awesome-query-builder/antd';
import { Button, Checkbox, MenuProps, Radio, Space, Typography } from 'antd';
import { isArray } from 'lodash';
import React from 'react';
import { ReactComponent as IconDeleteColored } from '../assets/svg/ic-delete-colored.svg';
import ProfilePicture from '../components/common/ProfilePicture/ProfilePicture';
import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import { getCountBadge } from '../utils/EntityDisplayUtils';
import { getSearchLabel } from './AdvancedSearchPureUtils';
import { t } from './i18next/LocalUtil';

export const renderAdvanceSearchButtons: RenderSettings['renderButton'] = (
  props
) => {
  const type = props?.type;

  if (type === 'delRule') {
    return (
      <Icon
        className="action action--DELETE"
        component={
          CloseCircleOutlined as React.ForwardRefExoticComponent<CustomIconComponentProps>
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

export const generateSearchDropdownLabel = (
  option: SearchDropdownOption,
  checked: boolean,
  searchKey: string,
  showProfilePicture: boolean,
  hideCounts = false,
  singleSelect = false
) => {
  const InputComponent = singleSelect ? Radio : Checkbox;

  return (
    <div className="d-flex justify-between">
      <Space align="start" className="m-x-sm" data-testid={option.key} size={8}>
        <InputComponent
          checked={checked}
          data-testid={`${option.key}-${singleSelect ? 'radio' : 'checkbox'}`}
          style={option.description ? { marginTop: 4 } : undefined}
        />
        {showProfilePicture && (
          <ProfilePicture
            displayName={option.label}
            name={option.label || ''}
            width="18"
          />
        )}
        <div>
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
          {option.description && (
            <Typography.Text
              className="text-xs d-block"
              data-testid={`${option.key}-description`}
              type="secondary">
              {option.description}
            </Typography.Text>
          )}
        </div>
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
  hideCounts = false,
  singleSelect = false
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
        hideCounts,
        singleSelect
      ),
    }));
  } else {
    return [];
  }
};
