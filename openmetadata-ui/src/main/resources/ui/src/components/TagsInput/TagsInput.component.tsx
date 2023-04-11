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
import { Button, Typography } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { TagDetails } from 'components/TableQueries/TableQueryRightPanel/TableQueryRightPanel.interface';
import TagsContainer from 'components/Tag/TagsContainer/tags-container';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { LabelType, State, TagLabel } from 'generated/type/tagLabel';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import React, { useEffect, useState } from 'react';
import { fetchTagsAndGlossaryTerms } from 'utils/TagsUtils';

type Props = {
  editable: boolean;
  tags?: TagLabel[];
  onTagsUpdate: (updatedTags: TagLabel[]) => Promise<void>;
};

const TagsInput: React.FC<Props> = ({ tags = [], editable, onTagsUpdate }) => {
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

  const addButtonHandler = () => {
    setIsEditTags(true);
    if (isEmpty(tagDetails.options) || tagDetails.isError) {
      fetchTags();
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  return (
    <div className="tags-input-container" data-testid="tags-input-container">
      <div className="d-flex items-center mb-2">
        <Typography.Text className="glossary-subheading">
          {t('label.tag-plural')}
        </Typography.Text>
        {editable && tags.length > 0 && (
          <Button
            className="cursor-pointer m-l-xs"
            data-testid="edit-button"
            disabled={!editable}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
            size="small"
            type="text"
            onClick={() => setIsEditTags(true)}
          />
        )}
      </div>
      <TagsContainer
        editable={isEditTags}
        isLoading={tagDetails.isLoading}
        selectedTags={getSelectedTags()}
        showAddTagButton={tags.length === 0}
        size="small"
        tagList={tagDetails.options}
        type="label"
        onAddButtonClick={addButtonHandler}
        onCancel={() => setIsEditTags(false)}
        onSelectionChange={handleTagSelection}
      />
    </div>
  );
};

export default TagsInput;
