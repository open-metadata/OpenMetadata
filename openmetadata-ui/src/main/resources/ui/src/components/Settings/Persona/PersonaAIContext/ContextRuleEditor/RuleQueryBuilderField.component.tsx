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
import { Button } from '@openmetadata/ui-core-components';
import {
  Actions,
  Config,
  FieldOrGroup,
  JsonTree,
} from '@react-awesome-query-builder/antd';
import { Plus } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { getAllCustomProperties } from '../../../../../rest/metadataTypeAPI';
import {
  getTreeConfig,
  processEntityTypeFields,
} from '../../../../../utils/AdvancedSearchUtils';
import { getRuleFilterTree } from '../../../../../utils/PersonaAIContextUtils';
import searchClassBase from '../../../../../utils/SearchClassBase';
import { DrawerPopupContainerProvider } from '../../../../common/DrawerPopupContainerProvider';
import QueryBuilderWidgetV1 from '../../../../common/QueryBuilderWidgetV1/QueryBuilderWidgetV1';
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
  const { t } = useTranslation();
  const [queryActions, setQueryActions] = useState<Actions>();
  const [enrichedFields, setEnrichedFields] = useState<
    Config['fields'] | undefined
  >();
  const cancelRef = useRef(0);

  useEffect(() => {
    const requestId = ++cancelRef.current;

    const loadCustomProperties = async () => {
      const subfields: Record<string, FieldOrGroup> = {};
      try {
        const res = await getAllCustomProperties();
        Object.entries(res).forEach(([resEntityType, fields]) => {
          processEntityTypeFields(
            resEntityType,
            fields,
            subfields,
            entityType,
            SearchOutputType.ElasticSearch
          );
        });
      } catch {
        // non-critical — custom properties unavailable, fall back to empty subfields
      }

      if (requestId !== cancelRef.current) {
        return;
      }

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
    };

    loadCustomProperties();
  }, [entityType]);

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
      <QueryBuilderWidgetV1
        entityType={entityType as EntityType}
        fields={enrichedFields}
        getQueryActions={setQueryActions}
        outputType={SearchOutputType.ElasticSearch}
        readonly={readonly}
        showCountPreview={false}
        tree={tree}
        value={queryFilter ?? ''}
        onChange={handleChange}
        onValidityChange={onValidityChange}
      />
      {!readonly && (
        <Button
          className="m-t-sm tw:self-start"
          color="link-color"
          data-testid="add-context-condition"
          iconLeading={Plus}
          isDisabled={!queryActions?.addRule}
          size="sm"
          onClick={() => queryActions?.addRule([])}>
          {t('label.add-condition-button')}
        </Button>
      )}
    </DrawerPopupContainerProvider>
  );
};
