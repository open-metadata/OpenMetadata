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
  Config,
  FieldOrGroup,
  JsonTree,
} from '@react-awesome-query-builder/ui';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EntityType } from '../../../../../enums/entity.enum';
import { getAllCustomProperties } from '../../../../../rest/metadataTypeAPI';
import {
  getTreeConfig,
  processEntityTypeFields,
} from '../../../../../utils/AdvancedSearchUtils';
import { getRuleFilterTree } from '../../../../../utils/PersonaAIContextUtils';
import searchClassBase from '../../../../../utils/SearchClassBase';
import { DrawerPopupContainerProvider } from '../../../../common/DrawerPopupContainerProvider/DrawerPopupContainerProvider';
import QueryBuilder from '../../../../common/QueryBuilder/QueryBuilder';
import { SearchOutputType } from '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';

interface RuleQueryBuilderFieldProps {
  entityType: string;
  filterJsonTree?: string;
  queryFilter?: string;
  readonly?: boolean;
  onChange: (queryFilter: string, filterJsonTree?: string) => void;
  onValidityChange?: (isValid: boolean) => void;
}

export const RuleQueryBuilderField = ({
  entityType,
  filterJsonTree,
  queryFilter,
  readonly,
  onChange,
  onValidityChange,
}: RuleQueryBuilderFieldProps) => {
  const [enrichedFields, setEnrichedFields] = useState<
    Config['fields'] | undefined
  >();
  // getAllCustomProperties returns data for ALL entity types regardless of
  // which entityType is currently selected — fetch once on mount and cache it
  // in state. The second effect rebuilds enriched fields whenever entityType
  // changes without issuing a redundant network request.
  const [customProps, setCustomProps] = useState<Awaited<
    ReturnType<typeof getAllCustomProperties>
  > | null>(null);

  useEffect(() => {
    getAllCustomProperties()
      .then(setCustomProps)
      .catch(() => setCustomProps({}));
  }, []);

  useEffect(() => {
    // Skip until the custom-property fetch resolves; the effect re-runs
    // automatically once customProps transitions from null to the map.
    if (customProps === null) {
      return;
    }

    const subfields: Record<string, FieldOrGroup> = {};
    Object.entries(customProps).forEach(([resEntityType, fields]) => {
      processEntityTypeFields(
        resEntityType,
        fields,
        subfields,
        entityType,
        SearchOutputType.ElasticSearch
      );
    });

    const searchIndex =
      searchClassBase.getEntityTypeSearchIndexMapping()[entityType];
    const baseConfig = getTreeConfig({
      searchIndex,
      searchOutputType: SearchOutputType.ElasticSearch,
      isExplorePage: false,
    });
    const nextFields = { ...baseConfig.fields };
    if (!isEmpty(subfields) && 'subfields' in nextFields.extension) {
      nextFields.extension = { ...nextFields.extension, subfields };
    }
    setEnrichedFields(nextFields);
  }, [entityType, customProps]);

  const tree = useMemo(
    () => getRuleFilterTree(filterJsonTree, queryFilter),
    [filterJsonTree, queryFilter]
  );
  const handleChange = useCallback(
    (value: string, updatedTree?: JsonTree) =>
      onChange(
        value,
        updatedTree ? JSON.stringify(updatedTree) : filterJsonTree
      ),
    [filterJsonTree, onChange]
  );

  return (
    <DrawerPopupContainerProvider>
      <div className="persona-context-rule-builder tw:rounded-lg tw:border tw:border-secondary tw:p-3">
        <QueryBuilder
          entityType={entityType as EntityType}
          fields={enrichedFields}
          groupMode="flat"
          outputType={SearchOutputType.ElasticSearch}
          readonly={readonly}
          showCountPreview={false}
          tree={tree}
          value={queryFilter ?? ''}
          onChange={handleChange}
          onValidityChange={onValidityChange}
        />
      </div>
    </DrawerPopupContainerProvider>
  );
};
