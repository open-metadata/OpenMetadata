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
import { Button, Col, Row, Space, Typography } from 'antd';
import { t } from 'i18next';
import { cloneDeep, includes, isEmpty, isEqual } from 'lodash';
import React, { ReactNode, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import { UserSelectableList } from '../../../components/common/UserSelectableList/UserSelectableList.component';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { OperationPermission } from '../../../components/PermissionProvider/PermissionProvider.interface';
import TagButton from '../../../components/TagButton/TagButton.component';
import {
  DE_ACTIVE_COLOR,
  getTeamAndUserDetailsPath,
  getUserPath,
  NO_DATA_PLACEHOLDER,
} from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Glossary, TagSource } from '../../../generated/entity/data/glossary';
import {
  GlossaryTerm,
  TagLabel,
} from '../../../generated/entity/data/glossaryTerm';
import { ChangeDescription } from '../../../generated/entity/type';
import { EntityReference } from '../../../generated/type/entityReference';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
  getDiffValue,
  getEntityVersionTags,
} from '../../../utils/EntityVersionUtils';
import { DomainLabel } from '../../common/DomainLabel/DomainLabel.component';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
import GlossaryReviewers from './GlossaryReviewers';

type Props = {
  isVersionView?: boolean;
  permissions: OperationPermission;
  selectedData: Glossary | GlossaryTerm;
  isGlossary: boolean;
  onUpdate: (data: GlossaryTerm | Glossary) => void;
  onThreadLinkSelect: (value: string) => void;
};

const GlossaryDetailsRightPanel = ({
  permissions,
  selectedData,
  isGlossary,
  onUpdate,
  isVersionView,
  onThreadLinkSelect,
}: Props) => {
  const hasEditReviewerAccess = useMemo(() => {
    return permissions.EditAll || permissions.EditReviewers;
  }, [permissions]);

  const noReviewersSelected =
    selectedData.reviewers && selectedData.reviewers.length === 0;

  const handleTagsUpdate = async (updatedTags: TagLabel[]) => {
    if (updatedTags) {
      const updatedData = {
        ...selectedData,
        tags: updatedTags,
      };

      onUpdate(updatedData);
    }
  };

  const handleReviewerSave = (data: Array<EntityReference>) => {
    if (!isEqual(data, selectedData.reviewers)) {
      let updatedGlossary = cloneDeep(selectedData);
      const oldReviewer = data.filter((d) =>
        includes(selectedData.reviewers, d)
      );
      const newReviewer = data
        .filter((d) => !includes(selectedData.reviewers, d))
        .map((d) => ({ id: d.id, type: d.type }));
      updatedGlossary = {
        ...updatedGlossary,
        reviewers: [...oldReviewer, ...newReviewer],
      };
      onUpdate(updatedGlossary);
    }
  };

  const handleUpdatedOwner = (newOwner: Glossary['owner']) => {
    const updatedData = {
      ...selectedData,
      owner: newOwner,
    };
    onUpdate(updatedData);
  };

  const getOwner = useCallback(
    (ownerDisplayName: string | ReactNode, owner?: EntityReference) => {
      if (owner) {
        return (
          <>
            <ProfilePicture
              displayName={getEntityName(owner)}
              name={owner?.name ?? ''}
              textClass="text-xs"
              width="20"
            />
            <Link
              to={
                owner.type === 'team'
                  ? getTeamAndUserDetailsPath(owner.name ?? '')
                  : getUserPath(owner.name ?? '')
              }>
              {ownerDisplayName}
            </Link>
          </>
        );
      }
      if (!(permissions.EditOwner || permissions.EditAll)) {
        return <div>{NO_DATA_PLACEHOLDER}</div>;
      }

      return null;
    },
    [permissions]
  );

  const getUserNames = useCallback(
    (glossaryData: Glossary | GlossaryTerm) => {
      if (isVersionView) {
        const ownerDiff = getDiffByFieldName(
          EntityField.OWNER,
          glossaryData.changeDescription as ChangeDescription
        );

        const oldOwner = JSON.parse(
          getChangedEntityOldValue(ownerDiff) ?? '{}'
        );
        const newOwner = JSON.parse(
          getChangedEntityNewValue(ownerDiff) ?? '{}'
        );

        const shouldShowDiff =
          !isEmpty(ownerDiff.added) ||
          !isEmpty(ownerDiff.deleted) ||
          !isEmpty(ownerDiff.updated);

        if (shouldShowDiff) {
          if (!isEmpty(ownerDiff.added)) {
            const ownerName = getDiffValue('', getEntityName(newOwner));

            return getOwner(ownerName, newOwner);
          }

          if (!isEmpty(ownerDiff.deleted)) {
            const ownerName = getDiffValue(getEntityName(oldOwner), '');

            return getOwner(ownerName, oldOwner);
          }

          if (!isEmpty(ownerDiff.updated)) {
            const ownerName = getDiffValue(
              getEntityName(oldOwner),
              getEntityName(newOwner)
            );

            return getOwner(ownerName, newOwner);
          }
        }
      }

      return getOwner(getEntityName(glossaryData.owner), glossaryData.owner);
    },
    [isVersionView, getOwner]
  );

  const tags = useMemo(
    () =>
      isVersionView
        ? getEntityVersionTags(
            selectedData,
            selectedData.changeDescription as ChangeDescription
          )
        : selectedData.tags,
    [isVersionView, selectedData]
  );

  return (
    <Row gutter={[0, 40]}>
      <Col span={24}>
        <DomainLabel
          showDomainHeading
          domain={selectedData.domain}
          entityFqn={selectedData.fullyQualifiedName ?? ''}
          entityId={selectedData.id ?? ''}
          entityType={
            isGlossary ? EntityType.GLOSSARY : EntityType.GLOSSARY_TERM
          }
          hasPermission={permissions.EditAll}
        />
      </Col>
      <Col data-testid="glossary-owner-name" span="24">
        <div className="d-flex items-center m-b-xs">
          <Typography.Text className="right-panel-label">
            {t('label.owner')}
          </Typography.Text>
          {(permissions.EditOwner || permissions.EditAll) &&
            selectedData.owner && (
              <UserTeamSelectableList
                hasPermission={permissions.EditOwner || permissions.EditAll}
                owner={selectedData.owner}
                onUpdate={handleUpdatedOwner}>
                <Button
                  className="cursor-pointer flex-center m-l-xss"
                  data-testid="edit-owner"
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                />
              </UserTeamSelectableList>
            )}
        </div>
        <Space className="m-r-xss" size={4}>
          {getUserNames(selectedData)}
        </Space>
        {!selectedData.owner && (permissions.EditOwner || permissions.EditAll) && (
          <UserTeamSelectableList
            hasPermission={permissions.EditOwner || permissions.EditAll}
            owner={selectedData.owner}
            onUpdate={handleUpdatedOwner}>
            <TagButton
              className="text-primary cursor-pointer"
              icon={<PlusIcon height={16} name="plus" width={16} />}
              label={t('label.add')}
              tooltip=""
            />
          </UserTeamSelectableList>
        )}
      </Col>
      <Col data-testid="glossary-reviewer" span="24">
        <div
          className={`d-flex items-center ${
            selectedData.reviewers && selectedData.reviewers.length > 0
              ? 'm-b-xss'
              : ''
          }`}>
          <Typography.Text
            className="right-panel-label"
            data-testid="glossary-reviewer-heading-name">
            {t('label.reviewer-plural')}
          </Typography.Text>
          {hasEditReviewerAccess &&
            selectedData.reviewers &&
            selectedData.reviewers.length > 0 && (
              <UserSelectableList
                hasPermission={hasEditReviewerAccess}
                popoverProps={{ placement: 'topLeft' }}
                selectedUsers={selectedData.reviewers ?? []}
                onUpdate={handleReviewerSave}>
                <Button
                  className="cursor-pointer flex-center m-l-xss"
                  data-testid="edit-reviewer-button"
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                />
              </UserSelectableList>
            )}
        </div>
        <div>
          <GlossaryReviewers
            editPermission={hasEditReviewerAccess}
            glossaryData={selectedData}
            isVersionView={isVersionView}
          />
          {hasEditReviewerAccess && noReviewersSelected && (
            <UserSelectableList
              hasPermission={hasEditReviewerAccess}
              popoverProps={{ placement: 'topLeft' }}
              selectedUsers={selectedData.reviewers ?? []}
              onUpdate={handleReviewerSave}>
              <TagButton
                className="text-primary cursor-pointer"
                icon={<PlusIcon height={16} name="plus" width={16} />}
                label={t('label.add')}
                tooltip=""
              />
            </UserSelectableList>
          )}
        </div>
      </Col>
      <Col span="24">
        <div data-testid="glossary-tags-name">
          {isGlossary && (
            <TagsContainerV2
              displayType={DisplayType.READ_MORE}
              entityFqn={selectedData.fullyQualifiedName}
              entityType={EntityType.GLOSSARY}
              permission={permissions.EditAll || permissions.EditTags}
              selectedTags={tags ?? []}
              tagType={TagSource.Classification}
              onSelectionChange={handleTagsUpdate}
              onThreadLinkSelect={onThreadLinkSelect}
            />
          )}
        </div>
      </Col>
    </Row>
  );
};

export default GlossaryDetailsRightPanel;
