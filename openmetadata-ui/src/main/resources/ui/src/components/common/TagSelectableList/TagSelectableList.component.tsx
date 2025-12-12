/*
 *  Copyright 2025 Collate.
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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ADD_USER_CONTAINER_HEIGHT } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/data/table';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import {
  convertEntityReferencesToTagLabels,
  convertTagLabelsToEntityReferences,
} from '../../../utils/EntityReferenceUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { TagListItemRenderer } from '../../../utils/TagsUtils';
import { EntitySelectableList } from '../EntitySelectableList/EntitySelectableList.component';
import { EntitySelectableListConfig } from '../EntitySelectableList/EntitySelectableList.interface';
import { TagSelectableListProps } from './TagSelectableList.interface';

const convertTagsToEntityReferences = (tags: TagLabel[]): EntityReference[] => {
  return convertTagLabelsToEntityReferences(tags);
};

const convertEntityReferencesToTags = (refs: EntityReference[]): TagLabel[] => {
  return convertEntityReferencesToTagLabels(refs, TagSource.Classification);
};

const fetchTagOptions = async (searchText: string, after?: string) => {
  try {
    const afterPage = after ? Number.parseInt(after, 10) : 1;
    const response = await tagClassBase.getTags(searchText, afterPage);
    const tags = response.data || [];

    const entityRefs: EntityReference[] = tags.map((tag) => ({
      id: tag.value,
      name: tag.data?.name || tag.label,
      displayName: tag.data?.displayName || tag.label,
      type: 'tag',
      fullyQualifiedName: tag.value,
      description: tag.data?.description,
    }));

    return {
      data: entityRefs,
      paging: {
        total: response.paging?.total || tags.length,
        after:
          tags.length > 0 && afterPage * 10 < (response.paging?.total || 0)
            ? String(afterPage + 1)
            : undefined,
      },
    };
  } catch (error) {
    return { data: [], paging: { total: 0 } };
  }
};

export const TagSelectableList = ({
  onCancel,
  selectedTags = [],
  onUpdate,
  children,
  popoverProps,
  listHeight = ADD_USER_CONTAINER_HEIGHT,
}: TagSelectableListProps & { listHeight?: number }) => {
  const { t } = useTranslation();

  const config: EntitySelectableListConfig<TagLabel> = useMemo(
    () => ({
      toEntityReference: convertTagsToEntityReferences,
      fromEntityReference: convertEntityReferencesToTags,
      fetchOptions: fetchTagOptions,
      customTagRenderer: TagListItemRenderer,
      searchPlaceholder: t('label.search-for-type', {
        type: t('label.tag'),
      }),
      searchBarDataTestId: 'tag-select-search-bar',
      overlayClassName: 'tag-select-popover',
    }),
    [t]
  );

  return (
    <EntitySelectableList
      config={config}
      listHeight={listHeight}
      popoverProps={popoverProps}
      selectedItems={selectedTags}
      onCancel={onCancel}
      onUpdate={onUpdate}>
      {children}
    </EntitySelectableList>
  );
};
