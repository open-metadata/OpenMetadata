/*
 *  Copyright 2026 Collate.
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

import {
  Field,
  FieldOrGroup,
  ListValues,
  ValueSource,
} from '@react-awesome-query-builder/ui';
import { isArray, isEmpty } from 'lodash';
import { SearchOutputType } from '../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { CustomPropertySummary } from '../rest/metadataTypeAPI.interface';
import { getTags } from '../rest/tagAPI';
import advancedSearchClassBase from './AdvancedSearchClassBase';
import jsonLogicSearchClassBase from './JSONLogicSearchClassBase';
import type { QueryBuilderConfigModes } from './queryBuilder/types';
import searchClassBase from './SearchClassBase';
import { toTagSelectOptions } from './SearchPureUtils';

export const getDropDownItems = (index: string): ExploreQuickFilterField[] => {
  return searchClassBase.getDropDownItems(index);
};

export const getTierOptions = async (): Promise<ListValues> => {
  try {
    const { data: tiers } = await getTags({
      parent: 'Tier',
      limit: 50,
    });

    return toTagSelectOptions(tiers) as ListValues;
  } catch {
    return [];
  }
};

// Legacy entry point: translates the single `isExplorePage` boolean into the explicit mode inputs the class bases now
// take.
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
  const modes: QueryBuilderConfigModes = isExplorePage
    ? {}
    : {
        showLabels: false,
        useFriendlyOperatorLabels: true,
      };

  if (searchOutputType === SearchOutputType.ElasticSearch) {
    return advancedSearchClassBase.getQbConfigs(index, modes);
  }

  // JSONLogic keeps its own icon-only renderer; only label visibility varies.
  return jsonLogicSearchClassBase.getQbConfigs(index, {
    showLabels: isExplorePage,
  });
};

// Process a custom property field and add it to the subfields @param field - The custom property field to process
// @param resEntityType - The entity type containing the field @param subfields - The subfields record to update @param
// entityType - Optional specific entity type to filter for
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

// Process all custom property fields for a specific entity type @param resEntityType - The entity type to process
// @param fields - Array of custom property fields @param subfields - The subfields record to update @param entityType -
// Optional specific entity type to filter for
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
