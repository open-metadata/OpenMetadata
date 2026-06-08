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
import { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';
import {
  Field,
  FieldOrGroup,
  ListValues,
  RenderSettings,
  ValueSource,
} from '@react-awesome-query-builder/antd';
import { Button, Checkbox, MenuProps, Radio, Space, Typography } from 'antd';
import { isArray, isEmpty } from 'lodash';
import React from 'react';
import { ReactComponent as IconDeleteColored } from '../assets/svg/ic-delete-colored.svg';
import ProfilePicture from '../components/common/ProfilePicture/ProfilePicture';
import { SearchOutputType } from '../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { CustomPropertySummary } from '../rest/metadataTypeAPI.interface';
import { getTags } from '../rest/tagAPI';
import { getCountBadge } from '../utils/EntityDisplayUtils';
import advancedSearchClassBase from './AdvancedSearchClassBase';
import { getSearchLabel } from './AdvancedSearchPureUtils';
import { t } from './i18next/LocalUtil';
import jsonLogicSearchClassBase from './JSONLogicSearchClassBase';
import searchClassBase from './SearchClassBase';

export {
  formatQueryValueBasedOnType,
  getAssetsPageQuickFilters,
  getChartsOptions,
  getColumnsOptions,
  getCustomPropertyAdvanceSearchEnumOptions,
  getDataModelOptions,
  getEmptyJsonTree,
  getEmptyJsonTreeForQueryBuilder,
  getOptionsFromAggregationBucket,
  getSchemaFieldOptions,
  getSearchLabel,
  getSelectedOptionLabelString,
  getServiceOptions,
  getTasksOptions,
} from './AdvancedSearchPureUtils';

export const getDropDownItems = (index: string): ExploreQuickFilterField[] => {
  return searchClassBase.getDropDownItems(index);
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
  } catch {
    return [];
  }
};

export const getTreeConfig = ({
  searchOutputType,
  searchIndex,
  isExplorePage,
}: {
  searchOutputType: SearchOutputType;
  searchIndex: SearchIndex | SearchIndex[];
  isExplorePage: boolean;
}) => {
  const index = isArray(searchIndex) ? searchIndex : [searchIndex];

  return searchOutputType === SearchOutputType.ElasticSearch
    ? advancedSearchClassBase.getQbConfigs(index, isExplorePage)
    : jsonLogicSearchClassBase.getQbConfigs(index, isExplorePage);
};

/**
 * Process a custom property field and add it to the subfields
 * @param field - The custom property field to process
 * @param resEntityType - The entity type containing the field
 * @param subfields - The subfields record to update
 * @param entityType - Optional specific entity type to filter for
 */
export const processCustomPropertyField = (
  field: CustomPropertySummary,
  resEntityType: string,
  subfields: Record<string, FieldOrGroup>,
  entityType?: string,
  searchOutputType?: SearchOutputType
) => {
  if (!field.name || !field.type) {
    return;
  }

  const result = advancedSearchClassBase.getCustomPropertiesSubFields(
    field,
    searchOutputType
  );
  const subfieldsArray = Array.isArray(result) ? result : [result];

  subfieldsArray.forEach(({ subfieldsKey, dataObject }) => {
    // If entityType is specified, return subfields directly without entityType wrapper
    if (entityType) {
      subfields[subfieldsKey] = {
        ...dataObject,
        valueSources: dataObject.valueSources as ValueSource[],
      };
    } else {
      // Create nested subfields for each entity type (e.g., table, database, etc.)
      const existingGroup = subfields[resEntityType];
      const entitySubfields: Record<string, Field> =
        existingGroup && 'subfields' in existingGroup
          ? existingGroup.subfields ?? {}
          : {};

      entitySubfields[subfieldsKey] = {
        ...dataObject,
        valueSources: dataObject.valueSources as ValueSource[],
      };

      // Only create the entity type field if it has custom properties
      if (!isEmpty(entitySubfields)) {
        subfields[resEntityType] = {
          label: resEntityType.charAt(0).toUpperCase() + resEntityType.slice(1),
          type: '!group',
          subfields: entitySubfields,
        };
      }
    }
  });
};

/**
 * Process all custom property fields for a specific entity type
 * @param resEntityType - The entity type to process
 * @param fields - Array of custom property fields
 * @param subfields - The subfields record to update
 * @param entityType - Optional specific entity type to filter for
 */
export const processEntityTypeFields = (
  resEntityType: string,
  fields: CustomPropertySummary[],
  subfields: Record<string, FieldOrGroup>,
  entityType?: string,
  searchOutputType?: SearchOutputType
) => {
  // If entityType is specified, only include custom properties for that entity type
  if (
    entityType &&
    entityType !== EntityType.ALL &&
    resEntityType !== entityType
  ) {
    return;
  }

  if (Array.isArray(fields) && fields.length > 0) {
    fields.forEach((field) => {
      processCustomPropertyField(
        field,
        resEntityType,
        subfields,
        entityType,
        searchOutputType
      );
    });
  }
};
