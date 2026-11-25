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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { getAllCustomProperties } from '../../../../rest/metadataTypeAPI';
import {
  getTreeConfig,
  processEntityTypeFields,
} from '../../../../utils/AdvancedSearchUtils';
import {
  getRuleFilterTree,
  isRuleFilterFullyRendered,
} from '../../../../utils/PersonaAIContextUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import Loader from '../../../common/Loader/Loader';
import QueryBuilder from '../../../common/QueryBuilder/QueryBuilder';
import { PERSONA_BUTTON_PRESET } from '../../../common/QueryBuilder/QueryBuilderCanvas/QueryBuilderCanvas.constants';
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';

interface RuleQueryBuilderFieldProps {
  entityType: string;
  filterJsonTree?: string;
  queryFilter?: string;
  readonly?: boolean;
  onChange: (queryFilter: string, filterJsonTree?: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  onReconstructionStatusChange?: (rendered: boolean) => void;
}

export const RuleQueryBuilderField = ({
  entityType,
  filterJsonTree,
  queryFilter,
  readonly,
  onChange,
  onValidityChange,
  onReconstructionStatusChange,
}: RuleQueryBuilderFieldProps) => {
  const [enrichedFields, setEnrichedFields] = useState<
    Config['fields'] | undefined
  >();
  const [builderComplete, setBuilderComplete] = useState(true);
  // getAllCustomProperties returns data for ALL entity types regardless of which entityType is currently selected —
  // fetch once on mount and cache it in state.
  const [customProps, setCustomProps] = useState<Awaited<
    ReturnType<typeof getAllCustomProperties>
  > | null>(null);

  useEffect(() => {
    getAllCustomProperties()
      .then(setCustomProps)
      .catch(() => setCustomProps({}));
  }, []);

  useEffect(() => {
    // Skip until the custom-property fetch resolves; the effect re-runs automatically once customProps transitions from
    // null to the map.
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

  const userEditedRef = useRef(false);
  const tree = useMemo(
    () => getRuleFilterTree(filterJsonTree, queryFilter),
    [filterJsonTree, queryFilter]
  );
  // A saved filter the builder shows only in part (or not at all) loses the
  // hidden conditions on the first builder edit, so the editor warns first.
  const isUnrendered =
    !isRuleFilterFullyRendered(filterJsonTree, queryFilter) ||
    Boolean(queryFilter && !builderComplete && !userEditedRef.current);
  const onReconstructionStatusChangeRef = useRef(onReconstructionStatusChange);
  onReconstructionStatusChangeRef.current = onReconstructionStatusChange;
  useEffect(() => {
    onReconstructionStatusChangeRef.current?.(!isUnrendered);
  }, [isUnrendered]);
  // A server-valid filter can use fields RAQB cannot display. Its mount-time
  // sanitization must not replace the saved DSL or block an unrelated edit.
  // Forward value and validity changes only after the user edits the filter.
  const markUserEdited = useCallback(() => {
    userEditedRef.current = true;
  }, []);
  const handleChange = useCallback(
    (value: string, updatedTree?: JsonTree) => {
      if (queryFilter && !userEditedRef.current) {
        return;
      }
      onChange(
        value,
        updatedTree ? JSON.stringify(updatedTree) : filterJsonTree
      );
    },
    [filterJsonTree, queryFilter, onChange]
  );
  const handleValidityChange = useCallback(
    (isValid: boolean) => {
      setBuilderComplete(isValid);
      if (!queryFilter || userEditedRef.current) {
        onValidityChange?.(isValid);
      }
    },
    [onValidityChange, queryFilter]
  );

  return (
    <div
      className="persona-context-rule-builder tw:rounded-lg tw:border tw:border-secondary tw:p-3"
      onKeyDownCapture={markUserEdited}
      onPointerDownCapture={markUserEdited}>
      {/* Mounting before the fields arrive lets RAQB's sanitizer field-null any saved extension.<cp> rule. */}
      {enrichedFields ? (
        <QueryBuilder
          buttonPreset={PERSONA_BUTTON_PRESET}
          entityType={entityType as EntityType}
          fields={enrichedFields}
          groupMode="flat"
          outputType={SearchOutputType.ElasticSearch}
          readonly={readonly}
          showCountPreview={false}
          tree={tree}
          value={queryFilter ?? ''}
          onChange={handleChange}
          onValidityChange={handleValidityChange}
        />
      ) : (
        <Loader size="small" />
      )}
    </div>
  );
};
