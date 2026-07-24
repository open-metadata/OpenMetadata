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
import { Actions, JsonTree } from '@react-awesome-query-builder/antd';
import { Plus } from '@untitledui/icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { getRuleFilterTree } from '../../../../../utils/PersonaAIContextUtils';
import { DrawerPopupContainerProvider } from '../../../../common/DrawerPopupContainerProvider';
import QueryBuilderWidgetV1 from '../../../../common/QueryBuilderWidgetV1/QueryBuilderWidgetV1';
import { SearchOutputType } from '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';

interface RuleQueryBuilderFieldProps {
  entityType: string;
  filterJsonTree?: string;
  queryFilter?: string;
  readonly?: boolean;
  onChange: (queryFilter: string, filterJsonTree?: string) => void;
}

export const RuleQueryBuilderField = ({
  entityType,
  filterJsonTree,
  queryFilter,
  readonly,
  onChange,
}: RuleQueryBuilderFieldProps) => {
  const { t } = useTranslation();
  const [queryActions, setQueryActions] = useState<Actions>();
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
        getQueryActions={setQueryActions}
        outputType={SearchOutputType.ElasticSearch}
        readonly={readonly}
        showCountPreview={false}
        tree={tree}
        value={queryFilter ?? ''}
        onChange={handleChange}
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
