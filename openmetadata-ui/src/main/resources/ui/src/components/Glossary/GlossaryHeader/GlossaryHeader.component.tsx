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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Col, Input, Row, Space, Tooltip, Typography } from 'antd';
import Description from 'components/common/description/Description';
import OwnerWidgetWrapper from 'components/common/OwnerWidget/OwnerWidgetWrapper.component';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import ReviewerModal from 'components/Modals/ReviewerModal/ReviewerModal.component';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { getUserPath } from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { EntityReference, Glossary } from 'generated/entity/data/glossary';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { cloneDeep, includes, isEqual } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/CommonUtils';
import SVGIcons, { Icons } from 'utils/SvgUtils';

export interface GlossaryHeaderProps {
  supportAddOwner?: boolean;
  selectedData: Glossary | GlossaryTerm;
  permissions: OperationPermission;
  onUpdate: (data: GlossaryTerm | Glossary) => void;
}

const GlossaryHeader = ({
  selectedData,
  permissions,
  onUpdate,
}: GlossaryHeaderProps) => {
  const { t } = useTranslation();

  const [displayName, setDisplayName] = useState<string>();
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [isEditOwner, setIsEditOwner] = useState<boolean>(false);
  const [showReviewerModal, setShowReviewerModal] = useState<boolean>(false);

  const editDisplayNamePermission = useMemo(() => {
    return permissions.EditAll || permissions.EditDisplayName;
  }, [permissions]);

  const onDisplayNameChange = (value: string) => {
    if (selectedData.displayName !== value) {
      setDisplayName(value);
    }
  };

  const onDisplayNameSave = () => {
    let updatedDetails = cloneDeep(selectedData);

    updatedDetails = {
      ...selectedData,
      displayName: displayName?.trim(),
      name: displayName?.trim() || selectedData.name,
    };

    onUpdate(updatedDetails);

    setIsNameEditing(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (selectedData.description !== updatedHTML) {
      const updatedTableDetails = {
        ...selectedData,
        description: updatedHTML,
      };
      onUpdate(updatedTableDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const handleRemoveReviewer = (id: string) => {
    let updatedGlossary = cloneDeep(selectedData);
    const reviewer = updatedGlossary.reviewers?.filter(
      (glossary) => glossary.id !== id
    );
    updatedGlossary = {
      ...updatedGlossary,
      reviewers: reviewer,
    };

    onUpdate(updatedGlossary);
  };

  const handleUpdatedOwner = (newOwner: Glossary['owner']) => {
    if (newOwner) {
      const updatedData = {
        ...selectedData,
        owner: newOwner,
      };
      onUpdate(updatedData);
    }
  };

  const handleRemoveOwner = () => {
    const updatedData = {
      ...selectedData,
      owner: undefined,
    };
    onUpdate(updatedData);
    setIsEditOwner(false);
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
    setShowReviewerModal(false);
  };

  useEffect(() => {
    setDisplayName(selectedData.displayName);
  }, [selectedData]);

  return (
    <Row gutter={[0, 8]}>
      <Col span={24}>
        {isNameEditing ? (
          <Space direction="horizontal">
            <Input
              className="input-width"
              data-testid="displayName"
              name="displayName"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
            />
            <Button
              data-testid="cancelAssociatedTag"
              icon={<CloseOutlined />}
              size="small"
              type="primary"
              onMouseDown={() => setIsNameEditing(false)}
            />

            <Button
              data-testid="saveAssociatedTag"
              icon={<CheckOutlined />}
              size="small"
              type="primary"
              onMouseDown={onDisplayNameSave}
            />
          </Space>
        ) : (
          <Space direction="horizontal">
            <Typography.Title className="m-b-0" level={5}>
              {getEntityName(selectedData)}
            </Typography.Title>
            <Tooltip
              title={
                editDisplayNamePermission
                  ? t('label.edit-entity', { entity: t('label.name') })
                  : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                disabled={!editDisplayNamePermission}
                icon={<SVGIcons alt="icon-tag" icon={Icons.EDIT} width="16" />}
                type="text"
                onClick={() => setIsNameEditing(true)}
              />
            </Tooltip>
          </Space>
        )}
      </Col>
      <Col span={24}>
        <Space className="flex-wrap" direction="horizontal">
          <div className="flex items-center">
            <Typography.Text className="text-grey-muted m-r-xs">
              {`${t('label.owner')}:`}
            </Typography.Text>

            {selectedData.owner && getEntityName(selectedData.owner) ? (
              <Space className="m-r-xss" size={4}>
                <ProfilePicture
                  displayName={getEntityName(selectedData.owner)}
                  id={selectedData.owner?.id || ''}
                  name={selectedData.owner?.name || ''}
                  textClass="text-xs"
                  width="20"
                />
                <Link to={getUserPath(selectedData.owner.name ?? '')}>
                  {getEntityName(selectedData.owner)}
                </Link>
              </Space>
            ) : (
              <span className="text-grey-muted">
                {t('label.no-entity', {
                  entity: t('label.owner-lowercase'),
                })}
              </span>
            )}
            <div className="tw-relative">
              <Tooltip
                placement="topRight"
                title={
                  permissions.EditAll || permissions.EditOwner
                    ? 'Update Owner'
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  className="flex-center p-0"
                  data-testid="owner-dropdown"
                  disabled={!(permissions.EditOwner || permissions.EditAll)}
                  icon={
                    <SVGIcons
                      alt="edit"
                      icon={Icons.EDIT}
                      title="Edit"
                      width="16px"
                    />
                  }
                  size="small"
                  type="text"
                  onClick={() => setIsEditOwner(true)}
                />
              </Tooltip>
              {isEditOwner && (
                <OwnerWidgetWrapper
                  currentUser={selectedData.owner}
                  hideWidget={() => setIsEditOwner(false)}
                  removeOwner={handleRemoveOwner}
                  updateUser={handleUpdatedOwner}
                  visible={isEditOwner}
                />
              )}
            </div>
          </div>
          <span className="tw-mr-1 tw-inline-block tw-text-gray-400">|</span>

          <div
            className="flex items-center tw-flex-wrap"
            data-testid="reviewer-card-container">
            <Typography.Text className="text-grey-muted m-r-xs">
              {`${t('label.reviewer')}:`}
            </Typography.Text>{' '}
            {selectedData.reviewers && selectedData.reviewers.length ? (
              <>
                {selectedData.reviewers.map((reviewer) => (
                  <Space
                    className="m-r-xss"
                    data-testid={`reviewer-${reviewer.displayName}`}
                    key={reviewer.name}
                    size={4}>
                    <ProfilePicture
                      displayName={getEntityName(reviewer)}
                      id={reviewer.id || ''}
                      name={reviewer?.name || ''}
                      textClass="text-xs"
                      width="20"
                    />
                    <Space size={2}>
                      <Link to={getUserPath(reviewer.name ?? '')}>
                        {getEntityName(reviewer)}
                      </Link>
                      <Tooltip
                        title={
                          permissions.EditAll
                            ? 'Remove Reviewer'
                            : NO_PERMISSION_FOR_ACTION
                        }>
                        <Button
                          className="p-0 flex-center"
                          data-testid="remove"
                          disabled={!permissions.EditAll}
                          icon={<CloseOutlined />}
                          size="small"
                          type="text"
                          onClick={() => handleRemoveReviewer(reviewer.id)}
                        />
                      </Tooltip>
                    </Space>
                  </Space>
                ))}
              </>
            ) : (
              <span className="text-grey-muted">
                {t('label.no-entity', {
                  entity: t('label.reviewer-plural'),
                })}
              </span>
            )}
            <Tooltip
              placement="topRight"
              title={
                permissions.EditAll ? 'Add Reviewer' : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                className="p-0 flex-center"
                data-testid="add-new-reviewer"
                disabled={!permissions.EditAll}
                icon={
                  <SVGIcons
                    alt="edit"
                    icon={Icons.EDIT}
                    title="Edit"
                    width="16px"
                  />
                }
                size="small"
                type="text"
                onClick={() => setShowReviewerModal(true)}
              />
            </Tooltip>
          </div>
        </Space>
      </Col>
      <Col data-testid="updated-by-container" span={24}>
        <Description
          description={selectedData?.description || ''}
          entityName={selectedData?.displayName ?? selectedData?.name}
          hasEditAccess={permissions.EditDescription || permissions.EditAll}
          isEdit={isDescriptionEditable}
          onCancel={() => setIsDescriptionEditable(false)}
          onDescriptionEdit={() => setIsDescriptionEditable(true)}
          onDescriptionUpdate={onDescriptionUpdate}
        />
      </Col>
      <ReviewerModal
        header={t('label.add-entity', {
          entity: t('label.reviewer'),
        })}
        reviewer={selectedData.reviewers}
        visible={showReviewerModal}
        onCancel={() => setShowReviewerModal(false)}
        onSave={handleReviewerSave}
      />
    </Row>
  );
};

export default GlossaryHeader;
