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

import Icon from '@ant-design/icons';
import { Button, Col, Drawer, Row, Space, Tooltip, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as IconUser } from '../../../../assets/svg/user.svg';
import { DE_ACTIVE_COLOR, getUserPath } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import { Query } from '../../../../generated/entity/data/query';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { getEntityName } from '../../../../utils/EntityUtils';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
import Loader from '../../../common/Loader/Loader';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import TagsInput from '../../../TagsInput/TagsInput.component';
import { TableQueryRightPanelProps } from './TableQueryRightPanel.interface';

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
  const handleTagSelection = async (tags?: TagLabel[]) => {
    if (tags) {
      const updatedData = {
        ...query,
        tags,
      };
      await onQueryUpdate(updatedData, 'tags');
    }
  };

  return (
    <Drawer
      destroyOnClose
      open
      className="query-right-panel"
      closable={false}
      getContainer={false}
      mask={false}
      title={null}
      width="100%">
      {isLoading ? (
        <Loader />
      ) : (
        <Row className="m-y-md p-x-md" gutter={[16, 40]}>
          <Col span={24}>
            <Space className="relative" direction="vertical" size={4}>
              <Space align="center" className="w-full" size={0}>
                <Typography.Text className="right-panel-label">
                  {t('label.owner')}
                </Typography.Text>

                {(EditAll || EditOwner) && (
                  <UserTeamSelectableList
                    hasPermission={EditAll || EditOwner}
                    owner={query.owner}
                    onUpdate={handleUpdateOwner}>
                    <Tooltip
                      title={t('label.edit-entity', {
                        entity: t('label.owner-lowercase'),
                      })}>
                      <Button
                        className="cursor-pointer flex-center"
                        data-testid="edit-owner"
                        icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                        size="small"
                        type="text"
                      />
                    </Tooltip>
                  </UserTeamSelectableList>
                )}
              </Space>
              <OwnerLabel hasPermission={false} owner={query.owner} />
            </Space>
          </Col>
          <Col span={24}>
            <Space direction="vertical" size={4}>
              <DescriptionV1
                description={query?.description || ''}
                entityType={EntityType.QUERY}
                hasEditAccess={EditDescription || EditAll}
                isEdit={isEditDescription}
                showCommentsIcon={false}
                onCancel={() => setIsEditDescription(false)}
                onDescriptionEdit={() => setIsEditDescription(true)}
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
            <Space className="m-b-md" direction="vertical" size={4}>
              <Typography.Text
                className="right-panel-label"
                data-testid="users">
                {t('label.user-plural')}
              </Typography.Text>
              {query.users && query.users.length ? (
                <Space wrap size={6}>
                  {query.users.map((user) => (
                    <Space className="m-r-xss" key={user.id} size={4}>
                      <ProfilePicture
                        displayName={getEntityName(user)}
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
          <Col span={24}>
            <Space className="m-b-md" direction="vertical" size={4}>
              <Typography.Text
                className="right-panel-label"
                data-testid="used-by">
                {t('label.used-by')}
              </Typography.Text>
              {query.usedBy && query.usedBy.length ? (
                <Space wrap size={6}>
                  {query.usedBy.map((user) => (
                    <Space className="m-r-xss" key={user} size={4}>
                      <Icon component={IconUser} />
                      {user}
                    </Space>
                  ))}
                </Space>
              ) : (
                <Typography.Paragraph className="m-b-0 text-grey-muted">
                  {t('label.no-entity', {
                    entity: t('label.used-by'),
                  })}
                </Typography.Paragraph>
              )}
            </Space>
          </Col>
        </Row>
      )}
    </Drawer>
  );
};

export default TableQueryRightPanel;
