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
import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import { t } from 'i18next';
import { cloneDeep, includes, isEqual } from 'lodash';
import React, { useMemo } from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Glossary, TagSource } from '../../../generated/entity/data/glossary';
import {
  GlossaryTerm,
  TagLabel,
} from '../../../generated/entity/data/glossaryTerm';
import { ChangeDescription } from '../../../generated/entity/type';
import { EntityReference } from '../../../generated/type/entityReference';
import {
  getEntityVersionTags,
  getOwnerVersionLabel,
} from '../../../utils/EntityVersionUtils';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import { ExtentionEntitiesKeys } from '../../common/CustomPropertyTable/CustomPropertyTable.interface';
import { DomainLabel } from '../../common/DomainLabel/DomainLabel.component';
import TagButton from '../../common/TagButton/TagButton.component';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';

type Props = {
  isVersionView?: boolean;
  permissions: OperationPermission;
  selectedData: Glossary | GlossaryTerm;
  isGlossary: boolean;
  onUpdate: (data: GlossaryTerm | Glossary) => void | Promise<void>;
  onThreadLinkSelect: (value: string) => void;
  entityType: EntityType;
  refreshGlossaryTerms?: () => void;
  editCustomAttributePermission?: boolean;
  onExtensionUpdate?: (updatedTable: GlossaryTerm) => Promise<void>;
};

const GlossaryDetailsRightPanel = ({
  permissions,
  selectedData,
  isGlossary,
  onUpdate,
  isVersionView,
  onThreadLinkSelect,
  refreshGlossaryTerms,
  entityType,
  editCustomAttributePermission,
  onExtensionUpdate,
}: Props) => {
  const hasEditReviewerAccess = useMemo(() => {
    return permissions.EditAll || permissions.EditReviewers;
  }, [permissions]);

  const hasViewAllPermission = useMemo(() => {
    return permissions.ViewAll;
  }, [permissions]);

  const { assignedReviewers, hasReviewers } = useMemo(() => {
    const inheritedReviewers: EntityReference[] = [];
    const assignedReviewers: EntityReference[] = [];

    selectedData.reviewers?.forEach((item) => {
      if (item.inherited) {
        inheritedReviewers.push(item);
      } else {
        assignedReviewers.push(item);
      }
    });

    return {
      inheritedReviewers,
      assignedReviewers,
      hasReviewers: selectedData.reviewers && selectedData.reviewers.length > 0,
    };
  }, [selectedData.reviewers]);

  const handleTagsUpdate = async (updatedTags: TagLabel[]) => {
    if (updatedTags) {
      const updatedData = {
        ...selectedData,
        tags: updatedTags,
      };

      await onUpdate(updatedData);
    }
  };

  const handleReviewerSave = async (data?: EntityReference[]) => {
    const reviewers: EntityReference[] = data ?? [];

    if (!isEqual(reviewers, assignedReviewers)) {
      let updatedGlossary = cloneDeep(selectedData);
      const oldReviewer = reviewers.filter((d) =>
        includes(assignedReviewers, d)
      );
      const newReviewer = reviewers
        .filter((d) => !includes(assignedReviewers, d))
        .map((d) => ({ id: d.id, type: d.type }));
      updatedGlossary = {
        ...updatedGlossary,
        reviewers: [...oldReviewer, ...newReviewer],
      };
      await onUpdate(updatedGlossary);
    }
  };

  const handleUpdatedOwner = async (newOwner?: EntityReference[]) => {
    const updatedData = {
      ...selectedData,
      owners: newOwner,
    };
    await onUpdate(updatedData);
    refreshGlossaryTerms?.();
  };

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
    <Row data-testid="entity-right-panel" gutter={[0, 40]}>
      <Col span={24}>
        <DomainLabel
          showDomainHeading
          domain={selectedData.domain}
          entityFqn={selectedData.fullyQualifiedName ?? ''}
          entityId={selectedData.id ?? ''}
          entityType={
            isGlossary ? EntityType.GLOSSARY : EntityType.GLOSSARY_TERM
          }
          // Only allow domain selection at glossary level. Glossary Term will inherit
          hasPermission={isGlossary ? permissions.EditAll : false}
        />
      </Col>
      <Col data-testid="glossary-right-panel-owner-link" span="24">
        <div className="d-flex items-center m-b-xs">
          <Typography.Text className="right-panel-label">
            {t('label.owner')}
          </Typography.Text>
          {(permissions.EditOwners || permissions.EditAll) &&
            selectedData.owners &&
            selectedData.owners.length > 0 && (
              <UserTeamSelectableList
                hasPermission={permissions.EditOwners || permissions.EditAll}
                listHeight={200}
                multiple={{ user: true, team: false }}
                owner={selectedData.owners}
                onUpdate={(updatedUser) => handleUpdatedOwner(updatedUser)}>
                <Tooltip
                  title={t('label.edit-entity', {
                    entity: t('label.owner'),
                  })}>
                  <Button
                    className="cursor-pointer flex-center m-l-xss"
                    data-testid="edit-owner"
                    icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                    size="small"
                    type="text"
                  />
                </Tooltip>
              </UserTeamSelectableList>
            )}
        </div>
        <Space className="m-r-xss" size={4}>
          {getOwnerVersionLabel(
            selectedData,
            isVersionView ?? false,
            TabSpecificField.OWNERS,
            permissions.EditOwners || permissions.EditAll
          )}
        </Space>
        {selectedData.owners?.length === 0 &&
          (permissions.EditOwners || permissions.EditAll) && (
            <UserTeamSelectableList
              hasPermission={permissions.EditOwners || permissions.EditAll}
              listHeight={200}
              multiple={{ user: true, team: false }}
              owner={selectedData.owners}
              onUpdate={(updatedUser) => handleUpdatedOwner(updatedUser)}>
              <TagButton
                className="text-primary cursor-pointer"
                dataTestId="add-owner"
                icon={<PlusIcon height={16} name="plus" width={16} />}
                label={t('label.add')}
                tooltip=""
              />
            </UserTeamSelectableList>
          )}
      </Col>
      <Col data-testid="glossary-reviewer" span="24">
        <div className={`d-flex items-center ${hasReviewers ? 'm-b-xss' : ''}`}>
          <Typography.Text
            className="right-panel-label"
            data-testid="glossary-reviewer-heading-name">
            {t('label.reviewer-plural')}
          </Typography.Text>
          {hasEditReviewerAccess && hasReviewers && (
            <UserTeamSelectableList
              previewSelected
              hasPermission={hasEditReviewerAccess}
              label={t('label.reviewer-plural')}
              listHeight={200}
              multiple={{ user: true, team: false }}
              owner={assignedReviewers ?? []}
              popoverProps={{ placement: 'topLeft' }}
              onUpdate={handleReviewerSave}>
              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.reviewer-plural'),
                })}>
                <Button
                  className="cursor-pointer flex-center m-l-xss"
                  data-testid="edit-reviewer-button"
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                />
              </Tooltip>
            </UserTeamSelectableList>
          )}
        </div>
        <div>
          <div data-testid="glossary-reviewer-name">
            {getOwnerVersionLabel(
              selectedData,
              isVersionView ?? false,
              TabSpecificField.REVIEWERS,
              hasEditReviewerAccess
            )}
          </div>

          {hasEditReviewerAccess && !hasReviewers && (
            <UserTeamSelectableList
              previewSelected
              hasPermission={hasEditReviewerAccess}
              label={t('label.reviewer-plural')}
              listHeight={200}
              multiple={{ user: true, team: false }}
              owner={assignedReviewers ?? []}
              popoverProps={{ placement: 'topLeft' }}
              onUpdate={handleReviewerSave}>
              <TagButton
                className="text-primary cursor-pointer"
                icon={<PlusIcon height={16} name="plus" width={16} />}
                label={t('label.add')}
                tooltip=""
              />
            </UserTeamSelectableList>
          )}
        </div>
      </Col>
      {isGlossary && (
        <Col span="24">
          <div data-testid="glossary-tags-name">
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
          </div>
        </Col>
      )}
      <Col span="24">
        {!isGlossary && selectedData && (
          <CustomPropertyTable
            isRenderedInRightPanel
            entityDetails={selectedData as GlossaryTerm}
            entityType={entityType as ExtentionEntitiesKeys}
            handleExtensionUpdate={async (updatedTable) => {
              await onExtensionUpdate?.(updatedTable as GlossaryTerm);
            }}
            hasEditAccess={Boolean(editCustomAttributePermission)}
            hasPermission={hasViewAllPermission}
            maxDataCap={5}
          />
        )}
      </Col>
    </Row>
  );
};

export default GlossaryDetailsRightPanel;
