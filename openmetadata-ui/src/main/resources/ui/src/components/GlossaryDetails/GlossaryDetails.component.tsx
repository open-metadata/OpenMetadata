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

import { Button, Col, Row, Space } from 'antd';
import GlossaryHeader from 'components/Glossary/GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from 'components/Glossary/GlossaryTermTab/GlossaryTermTab.component';
import Tags from 'components/Tag/Tags/tags';
import { t } from 'i18next';
import { cloneDeep, includes, isEqual } from 'lodash';
import { EntityTags } from 'Models';
import React, { useEffect, useState } from 'react';
import { Glossary } from '../../generated/entity/data/glossary';
import { EntityReference } from '../../generated/type/entityReference';
import { LabelType, State, TagSource } from '../../generated/type/tagLabel';
import SVGIcons from '../../utils/SvgUtils';
import {
  getAllTagsForOptions,
  getTagOptionsFromFQN,
} from '../../utils/TagsUtils';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import TagsContainer from '../Tag/TagsContainer/tags-container';
import TagsViewer from '../Tag/TagsViewer/tags-viewer';
import './GlossaryDetails.style.less';

type props = {
  permissions: OperationPermission;
  glossary: Glossary;
  updateGlossary: (value: Glossary) => Promise<void>;
};

const GlossaryDetails = ({ permissions, glossary, updateGlossary }: props) => {
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);

  const [showRevieweModal, setShowRevieweModal] = useState(false);
  const [reviewer, setReviewer] = useState<Array<EntityReference>>([]);

  const onReviewerModalCancel = () => {
    setShowRevieweModal(false);
  };

  const handleReviewerSave = (data: Array<EntityReference>) => {
    if (!isEqual(data, reviewer)) {
      let updatedGlossary = cloneDeep(glossary);
      const oldReviewer = data.filter((d) => includes(reviewer, d));
      const newReviewer = data
        .filter((d) => !includes(reviewer, d))
        .map((d) => ({ id: d.id, type: d.type }));
      updatedGlossary = {
        ...updatedGlossary,
        reviewers: [...oldReviewer, ...newReviewer],
      };
      setReviewer(data);
      updateGlossary(updatedGlossary);
    }
    onReviewerModalCancel();
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags =
        glossary?.tags?.filter((tag) =>
          selectedTags.includes(tag?.tagFQN as string)
        ) || [];
      const newTags = selectedTags
        .filter((tag) => {
          return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: TagSource.Tag,
          tagFQN: tag,
        }));
      const updatedTags = [...prevTags, ...newTags];
      const updatedGlossary = { ...glossary, tags: updatedTags };
      updateGlossary(updatedGlossary);
    }
  };
  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    onTagUpdate?.(selectedTags?.map((tag) => tag.tagFQN));
    setIsTagEditable(false);
  };

  const getSelectedTags = () => {
    return (glossary.tags || []).map((tag) => ({
      tagFQN: tag.tagFQN,
      isRemovable: true,
    }));
  };

  const fetchTags = async () => {
    setIsTagLoading(true);
    const tags = await getAllTagsForOptions();
    setTagList(tags.map((t) => t.fullyQualifiedName ?? t.name));
    setIsTagLoading(false);
  };

  const handleTagContainerClick = () => {
    if (!isTagEditable) {
      fetchTags();
      setIsTagEditable(true);
    }
  };

  useEffect(() => {
    if (glossary.reviewers && glossary.reviewers.length) {
      setReviewer(
        glossary.reviewers.map((d) => ({
          ...d,
          type: 'user',
        }))
      );
    } else {
      setReviewer([]);
    }
  }, [glossary.reviewers]);

  return (
    <Row data-testid="glossary-details" gutter={[0, 16]}>
      <Col span={24}>
        <GlossaryHeader
          permissions={permissions}
          selectedData={glossary}
          onUpdate={updateGlossary}
        />
        {!isTagEditable && glossary?.tags && glossary.tags.length > 0 && (
          <>
            <SVGIcons
              alt="icon-tag"
              className="m-x-xss"
              icon="icon-tag-grey"
              width="16"
            />
            <TagsViewer tags={glossary.tags} />
          </>
        )}
        <Space
          className="items-center flex-wrap"
          data-testid="tags"
          onClick={handleTagContainerClick}>
          <TagsContainer
            buttonContainerClass="m-t-0"
            containerClass="flex items-center gap-2 m-t-xs"
            dropDownHorzPosRight={false}
            editable={isTagEditable}
            isLoading={isTagLoading}
            selectedTags={getSelectedTags()}
            showTags={false}
            size="small"
            tagList={getTagOptionsFromFQN(tagList)}
            type="label"
            onCancel={() => {
              handleTagSelection();
            }}
            onSelectionChange={(tags) => {
              handleTagSelection(tags);
            }}>
            {glossary?.tags && glossary?.tags.length ? (
              <Button
                className="p-0 m-l-xss flex-center"
                disabled={!(permissions.EditTags || permissions.EditAll)}
                icon={
                  <SVGIcons
                    alt="edit"
                    icon="icon-edit"
                    title="Edit"
                    width="16px"
                  />
                }
                type="text"
              />
            ) : (
              <Button
                className="p-0"
                disabled={!(permissions.EditTags || permissions.EditAll)}
                type="text">
                <Tags
                  className="tw-text-primary"
                  startWith="+ "
                  tag={t('label.add-entity', {
                    entity: t('label.tag-lowercase'),
                  })}
                  type="label"
                />
              </Button>
            )}
          </TagsContainer>
        </Space>
      </Col>

      <Col span={24}>
        <GlossaryTermTab
          glossaryId={glossary.id}
          selectedGlossaryFqn={glossary.fullyQualifiedName || glossary.name}
        />
      </Col>
      <ReviewerModal
        header={t('label.add-entity', {
          entity: t('label.reviewer'),
        })}
        reviewer={reviewer}
        visible={showRevieweModal}
        onCancel={onReviewerModalCancel}
        onSave={handleReviewerSave}
      />
    </Row>
  );
};

export default GlossaryDetails;
