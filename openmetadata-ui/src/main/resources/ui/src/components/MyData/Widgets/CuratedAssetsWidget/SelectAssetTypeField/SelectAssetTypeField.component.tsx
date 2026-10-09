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

import {
    Badge,
    TreeSelect,
    TreeSelectNode
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CURATED_ASSETS_LIST } from '../../../../../constants/AdvancedSearch.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { CuratedAssetsFormSelectedAssetsInfo } from '../../../../../utils/CuratedAssetsUtils';
import { EntityIconSize } from '../../../../../utils/EntityIconUtils';
import { getEntityNameLabel } from '../../../../../utils/EntityNameUtils';
import searchClassBase from '../../../../../utils/SearchClassBase';
import { useAdvanceSearch } from '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { CuratedAssetsConfig } from '../CuratedAssetsModal/CuratedAssetsModal.interface';

const toNode = (resource: string): TreeSelectNode => ({
  id: resource,
  value: resource,
  label: getEntityNameLabel(resource),
  icon: searchClassBase.getEntityIconWithBg(resource, EntityIconSize.Size14),
});

const matchesSearch = (node: TreeSelectNode, searchTerm: string) => {
  const term = searchTerm.toLowerCase();

  return (
    node.value.toLowerCase().includes(term) ||
    node.label.toLowerCase().includes(term)
  );
};

export const SelectAssetTypeField = ({
  fetchEntityCount,
}: {
  fetchEntityCount: (args: {
    countKey: string;
    selectedResource: string[];
    shouldUpdateResourceList: boolean;
  }) => Promise<void>;
  selectedAssetsInfo: CuratedAssetsFormSelectedAssetsInfo;
}) => {
  const { t } = useTranslation();
  const { control } = useFormContext<CuratedAssetsConfig>();
  const { onChangeSearchIndex } = useAdvanceSearch();

  const watchedResources = useWatch({ control, name: 'resources' });
  // Memoised so the `?? []` fallback does not hand every dependent hook a new array identity on each render.
  const selectedResource = useMemo(
    () => watchedResources ?? [],
    [watchedResources]
  );

  const { allNode, childNodes } = useMemo(() => {
    const childNodes = CURATED_ASSETS_LIST.filter(
      (resource) => resource !== EntityType.ALL
    ).map(toNode);

    return {
      allNode: { ...toNode(EntityType.ALL), children: childNodes },
      childNodes,
    };
  }, []);

  const fetchData = useCallback(async () => ({ nodes: [allNode] }), [allNode]);

  // `all` stands for every type, so it checks every child in the tree.
  const treeValue = useMemo(
    () =>
      selectedResource.includes(EntityType.ALL)
        ? [allNode, ...childNodes]
        : childNodes.filter((node) => selectedResource.includes(node.id)),
    [selectedResource, allNode, childNodes]
  );

  // Collapse a fully checked tree back to `all`, as the stored config expects.
  const fromTreeValue = useCallback(
    (value: TreeSelectNode | TreeSelectNode[] | null) => {
      const ids = (Array.isArray(value) ? value : []).map((node) => node.id);
      const allChildrenSelected = childNodes.every((node) =>
        ids.includes(node.id)
      );

      return allChildrenSelected
        ? [EntityType.ALL]
        : ids.filter((id) => id !== EntityType.ALL);
    },
    [childNodes]
  );

  const isAllSelected = selectedResource.includes(EntityType.ALL);

  const renderSelectedItem = useCallback(
    (node: TreeSelectNode) =>
      isAllSelected && node.id !== EntityType.ALL ? null : (
        <Badge color="gray" data-testid={`${node.id}-selected`} size="sm">
          {node.label}
        </Badge>
      ),
    [isAllSelected]
  );

  const handleEntityCountChange = useCallback(
    () =>
      fetchEntityCount?.({
        countKey: 'resourceCount',
        selectedResource,
        shouldUpdateResourceList: false,
      }),
    [fetchEntityCount, selectedResource]
  );

  useEffect(() => {
    const searchIndexMapping =
      searchClassBase.getEntityTypeSearchIndexMapping();

    onChangeSearchIndex(
      selectedResource.map((resource) => searchIndexMapping[resource])
    );

    if (!isEmpty(selectedResource)) {
      handleEntityCountChange();
    }
  }, [selectedResource, handleEntityCountChange, onChangeSearchIndex]);

  return (
    <Controller
      control={control}
      name="resources"
      render={({ field }) => (
        <TreeSelect
          cascadeSelection
          multiple
          searchable
          data-testid="asset-type-select"
          defaultExpandedKeys={[EntityType.ALL]}
          fetchData={fetchData}
          filterNode={matchesSearch}
          label={t('label.select-asset-type')}
          placeholder={t('label.select-asset-type')}
          renderSelectedItem={renderSelectedItem}
          value={treeValue}
          onChange={(value) => field.onChange(fromTreeValue(value))}
        />
      )}
    />
  );
};
