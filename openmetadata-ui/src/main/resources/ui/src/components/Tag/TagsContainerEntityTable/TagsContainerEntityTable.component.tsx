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

import { Button, Space } from 'antd';
import { ReactComponent as IconEdit } from 'assets/svg/edit-new.svg';
import Loader from 'components/Loader/Loader';
import { TableTagsProps } from 'components/TableTags/TableTags.interface';
import Tags from 'components/Tag/Tags/tags';
import { TAG_CONSTANT, TAG_START_WITH } from 'constants/Tag.constants';
import { TagSource } from 'generated/type/tagLabel';
import { isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import { getTagPlaceholder } from 'utils/TagsUtils';
import TagTree from '../TagsTree/TagsTreeForm.component';
import TagsViewer from '../TagsViewer/tags-viewer';
import { TagsContainerEntityTableProps } from './TagsContainerEntityTable.interface';

const TagsContainerEntityTable = ({
  isLoading,
  isEditing,
  permission,
  selectedTags,
  showEditButton,
  tagType,
  treeData,
  onCancel,
  onSelectionChange,
  onAddButtonClick,
}: TagsContainerEntityTableProps) => {
  const [tags, setTags] = useState<TableTagsProps>();

  const isGlossaryType = useMemo(
    () => tagType === TagSource.Glossary,
    [tagType]
  );

  const showAddTagButton = useMemo(
    () => permission && isEmpty(tags?.[tagType]),
    [permission, tags?.[tagType]]
  );

  const selectedTagsInternal = useMemo(
    () => tags?.[tagType].map(({ tagFQN }) => tagFQN as string),
    [tags, tagType]
  );

  const showNoDataPlaceholder = useMemo(
    () => !showAddTagButton && isEmpty(tags?.[tagType]),
    [showAddTagButton, tags?.[tagType]]
  );

  const getUpdatedTags = (selectedTag: string[]): EntityTags[] => {
    const updatedTags = selectedTag.map((t) => ({
      tagFQN: t,
      source: isGlossaryType ? TagSource.Glossary : TagSource.Classification,
    }));

    return updatedTags;
  };

  const handleSave = useCallback(
    (selectedTag: string[]) => {
      const updatedTags = getUpdatedTags(selectedTag);
      onSelectionChange([
        ...updatedTags,
        ...((isGlossaryType
          ? tags?.[TagSource.Classification]
          : tags?.[TagSource.Glossary]) ?? []),
      ]);
    },
    [isGlossaryType, tags, getUpdatedTags]
  );

  const editTagButton = useMemo(
    () =>
      !isEmpty(tags?.[tagType]) && showEditButton ? (
        <Button
          className="p-0 flex-center text-primary"
          data-testid="edit-button"
          icon={<IconEdit className="anticon" height={16} width={16} />}
          size="small"
          type="text"
          onClick={onAddButtonClick}
        />
      ) : null,
    [selectedTags, showEditButton, onAddButtonClick]
  );

  const addTagButton = useMemo(
    () =>
      showAddTagButton ? (
        <span onClick={onAddButtonClick}>
          <Tags
            className="tw-font-semibold tw-text-primary"
            startWith={TAG_START_WITH.PLUS}
            tag={TAG_CONSTANT}
            type="border"
          />
        </span>
      ) : null,
    [showAddTagButton]
  );

  const renderTags = useMemo(
    () => (
      <TagsViewer
        isTextPlaceholder
        showNoDataPlaceholder={showNoDataPlaceholder}
        tags={tags?.[tagType] ?? []}
        type="border"
      />
    ),
    [showNoDataPlaceholder, tags?.[tagType]]
  );

  const tagsSelectContainer = useMemo(() => {
    return isLoading ? (
      <Loader size="small" />
    ) : (
      <TagTree
        defaultValue={selectedTagsInternal ?? []}
        placeholder={getTagPlaceholder(isGlossaryType)}
        treeData={treeData}
        onCancel={onCancel}
        onSubmit={handleSave}
      />
    );
  }, [isGlossaryType, selectedTagsInternal, treeData, onCancel, handleSave]);

  useEffect(() => {
    setTags(getFilterTags(selectedTags));
  }, [selectedTags]);

  return (
    <div
      className="w-full"
      data-testid={isGlossaryType ? 'glossary-container' : 'tags-container'}>
      {!isEditing && (
        <Space wrap align="center" data-testid="entity-tags" size={4}>
          {addTagButton}
          {renderTags}
          {editTagButton}
        </Space>
      )}
      {isEditing && tagsSelectContainer}
    </div>
  );
};

export default TagsContainerEntityTable;
