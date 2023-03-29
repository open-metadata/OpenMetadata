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
import classNames from 'classnames';
import { TagDetails } from 'components/TableQueries/TableQueryRightPanel/TableQueryRightPanel.interface';
import TagsContainer from 'components/Tag/TagsContainer/tags-container';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { LabelType, State, TagLabel } from 'generated/type/tagLabel';
import { isEmpty, isUndefined } from 'lodash';
import { EntityTags } from 'Models';
import React, { useState } from 'react';
import { fetchTagsAndGlossaryTerms } from 'utils/TagsUtils';

type Props = {
  editable: boolean;
  tags?: TagLabel[];
  onTagsUpdate: (updatedTags: TagLabel[]) => Promise<void>;
};

const TagsInput: React.FC<Props> = ({ tags, editable, onTagsUpdate }) => {
  const [isEditTags, setIsEditTags] = useState(false);
  const [tagDetails, setTagDetails] = useState<TagDetails>({
    isLoading: false,
    isError: false,
    options: [],
  });

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
    setIsEditTags(false);
  };

  const fetchTags = async () => {
    setTagDetails((pre) => ({ ...pre, isLoading: true }));

    try {
      const response = await fetchTagsAndGlossaryTerms();
      setTagDetails((pre) => ({ ...pre, options: response }));
    } catch (_error) {
      setTagDetails((pre) => ({ ...pre, isError: true, options: [] }));
    } finally {
      setTagDetails((pre) => ({ ...pre, isLoading: false }));
    }
  };

  return (
    <div className="tags-input-container">
      {editable ? (
        <div
          className={classNames(
            `tw-flex tw-justify-content`,
            !isUndefined(tags)
              ? 'tw-flex-col tw-items-start'
              : 'tw-items-center'
          )}
          data-testid="tags-wrapper"
          onClick={() => {
            setIsEditTags(true);
            if (isEmpty(tagDetails.options) || tagDetails.isError) {
              fetchTags();
            }
          }}>
          <TagsContainer
            showAddTagButton
            className="w-min-15 "
            editable={isEditTags}
            isLoading={tagDetails.isLoading}
            selectedTags={tags || []}
            size="small"
            tagList={tagDetails.options}
            type="label"
            onCancel={() => setIsEditTags(false)}
            onSelectionChange={handleTagSelection}
          />
        </div>
      ) : (
        <TagsViewer sizeCap={-1} tags={tags || []} />
      )}
    </div>
  );
};

export default TagsInput;
