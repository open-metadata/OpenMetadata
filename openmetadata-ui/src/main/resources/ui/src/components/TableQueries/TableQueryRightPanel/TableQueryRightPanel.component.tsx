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
import Description from 'components/common/description/Description';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import { UserTeamSelectableList } from 'components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import Loader from 'components/Loader/Loader';
import TagsInput from 'components/TagsInput/TagsInput.component';
import { DE_ACTIVE_COLOR, getUserPath } from 'constants/constants';
import { Query } from 'generated/entity/data/query';
import { LabelType, State, TagLabel } from 'generated/type/tagLabel';
import { EntityTags } from 'Models';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { TableQueryRightPanelProps } from './TableQueryRightPanel.interface';
import { ReactComponent as EditIcon } from '/assets/svg/edit-new.svg';

const TableQueryRightPanel = ({
  query,
  onQueryUpdate,
  isLoading,
  permission,
}: TableQueryRightPanelProps) => {
  const { t } = useTranslation();
  const { EditAll, EditDescription, EditOwner, EditTags } = permission;

  const [isEditDescription, setIsEditDescription] = useState(false);

  const handleUpdateOwner = async (owner: Query['owner']) => {
    const updatedData = {
      ...query,
      owner,
    };
    await onQueryUpdate(updatedData, 'owner');
  };

  const onDescriptionUpdate = async (description: string) => {
    const updatedData = {
      ...query,
      description,
    };
    await onQueryUpdate(updatedData, 'description');
    setIsEditDescription(false);
  };
  const handleTagSelection = async (selectedTags?: EntityTags[]) => {
    const newSelectedTags: TagLabel[] | undefined = selectedTags?.map((tag) => {
      return {
        source: tag.source,
        tagFQN: tag.tagFQN,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
    });
    if (newSelectedTags) {
      const updatedData = {
        ...query,
        tags: newSelectedTags,
      };
      await onQueryUpdate(updatedData, 'tags');
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row className="m-y-md p-x-md" gutter={[16, 40]}>
      <Col span={24}>
        <Space className="relative" direction="vertical">
          <Space align="center" className="w-full" size={0}>
            <Typography.Text className="m-b-xs tw-text-base font-medium">
              {t('label.owner')}
            </Typography.Text>

            {(EditAll || EditOwner) && (
              <UserTeamSelectableList
                hasPermission={EditAll || EditOwner}
                owner={query.owner}
                onUpdate={handleUpdateOwner}>
                <Button
                  className="cursor-pointer flex-center"
                  data-testid="edit-owner-button"
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                />
              </UserTeamSelectableList>
            )}
          </Space>
          <div data-testid="owner-name-container">
            {query.owner && getEntityName(query.owner) ? (
              <Space className="m-r-xss" size={4}>
                <ProfilePicture
                  displayName={getEntityName(query.owner)}
                  id={query.owner?.id || ''}
                  name={query.owner?.name || ''}
                  width="20"
                />
                <Link
                  data-testid="owner-name"
                  to={getUserPath(query.owner.name ?? '')}>
                  {getEntityName(query.owner)}
                </Link>
              </Space>
            ) : (
              <span className="text-grey-muted">
                {t('label.no-entity', {
                  entity: t('label.owner-lowercase'),
                })}
              </span>
            )}
          </div>
        </Space>
      </Col>
      <Col span={24}>
        <Space direction="vertical">
          <Space align="center" size={0}>
            <Typography.Text className="m-b-xs tw-text-base font-medium">
              {t('label.description')}
            </Typography.Text>

            {(EditDescription || EditAll) && (
              <Button
                className="flex-center p-0"
                data-testid="edit-description-btn"
                icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                size="small"
                type="text"
                onClick={() => setIsEditDescription(true)}
              />
            )}
          </Space>
          <Description
            description={query?.description || ''}
            header={t('label.edit-entity', { entity: t('label.description') })}
            isEdit={isEditDescription}
            onCancel={() => setIsEditDescription(false)}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        </Space>
      </Col>
      <Col span={24}>
        <TagsInput
          editable={EditAll || EditTags}
          tags={query?.tags || []}
          onTagsUpdate={handleTagSelection}
        />
      </Col>
      <Col span={24}>
        <Space className="m-b-md" direction="vertical">
          <Typography.Text
            className="m-b-xs tw-text-base font-medium"
            data-testid="users">
            {t('label.user-plural')}
          </Typography.Text>
          {query.users && query.users.length ? (
            <Space wrap size={6}>
              {query.users.map((user) => (
                <Space className="m-r-xss" key={user.id} size={4}>
                  <ProfilePicture
                    displayName={getEntityName(user)}
                    id={user.id || ''}
                    name={user.name || ''}
                    textClass="text-xs"
                    width="20"
                  />
                  <Link to={getUserPath(user.name ?? '')}>
                    {getEntityName(user)}
                  </Link>
                </Space>
              ))}
            </Space>
          ) : (
            <Typography.Paragraph className="m-b-0 text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.user-plural'),
              })}
            </Typography.Paragraph>
          )}
        </Space>
      </Col>
    </Row>
  );
};

export default TableQueryRightPanel;
