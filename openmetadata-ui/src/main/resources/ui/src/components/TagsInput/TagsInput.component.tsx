/*
 *  Copyright 2023 Collate.
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
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { LabelType, State, TagLabel, TagSource } from 'generated/type/tagLabel';
import { EntityTags } from 'Models';
import React from 'react';

type Props = {
  isVersionView?: boolean;
  editable: boolean;
  tags?: TagLabel[];
  onTagsUpdate: (updatedTags: TagLabel[]) => Promise<void>;
};

const TagsInput: React.FC<Props> = ({
  tags = [],
  editable,
  onTagsUpdate,
  isVersionView,
}) => {
  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = selectedTags?.map((tag) => {
      return {
        source: tag.source,
        tagFQN: tag.tagFQN,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
    });
    if (onTagsUpdate) {
      await onTagsUpdate(updatedTags);
    }
  };

  const getSelectedTags = () => {
    if (tags) {
      return [
        ...tags.map((tag) => ({
          ...tag,
          isRemovable: false,
        })),
      ];
    } else {
      return [];
    }
  };

  return (
    <div className="tags-input-container" data-testid="tags-input-container">
      {isVersionView ? (
        <TagsViewer sizeCap={-1} tags={tags} type="border" />
      ) : (
        <TagsContainerV2
          permission={editable}
          selectedTags={getSelectedTags()}
          tagType={TagSource.Classification}
          onSelectionChange={handleTagSelection}
        />
      )}
    </div>
  );
};

export default TagsInput;
