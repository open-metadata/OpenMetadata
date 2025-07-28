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
import { Col, Drawer, Row, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconUser } from '../../../../assets/svg/user.svg';
import { EntityType } from '../../../../enums/entity.enum';
import { Query } from '../../../../generated/entity/data/query';
import { TagLabel, TagSource } from '../../../../generated/type/tagLabel';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getUserPath } from '../../../../utils/RouterUtils';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
import ExpandableCard from '../../../common/ExpandableCard/ExpandableCard';
import { EditIconButton } from '../../../common/IconButtons/EditIconButton';
import Loader from '../../../common/Loader/Loader';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import TagsContainerV2 from '../../../Tag/TagsContainerV2/TagsContainerV2';
import { TableQueryRightPanelProps } from './TableQueryRightPanel.interface';

const TableQueryRightPanel = ({
  query,
  onQueryUpdate,
  isLoading,
  permission,
}: TableQueryRightPanelProps) => {
  const { t } = useTranslation();
  const { EditAll, EditDescription, EditOwners, EditTags } = permission;

  const handleUpdateOwner = async (owners: Query['owners']) => {
    const updatedData = {
      ...query,
      owners,
    };
    await onQueryUpdate(updatedData, 'owners');
  };

  const onDescriptionUpdate = async (description: string) => {
    const updatedData = {
      ...query,
      description,
    };
    await onQueryUpdate(updatedData, 'description');
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
        <Row className="m-y-md p-x-md w-full" gutter={[16, 20]}>
          <Col span={24}>
            <ExpandableCard
              cardProps={{
                title: (
                  <Space align="center" className="w-full" size={0}>
                    <Typography.Text className="right-panel-label">
                      {t('label.owner-plural')}
                    </Typography.Text>

                    {(EditAll || EditOwners) && (
                      <UserTeamSelectableList
                        hasPermission={EditAll || EditOwners}
                        multiple={{ user: true, team: false }}
                        owner={query.owners}
                        onUpdate={(updatedUsers) =>
                          handleUpdateOwner(updatedUsers)
                        }>
                        <EditIconButton
                          data-testid="edit-owner"
                          size="small"
                          title={t('label.edit-entity', {
                            entity: t('label.owner-lowercase-plural'),
                          })}
                        />
                      </UserTeamSelectableList>
                    )}
                  </Space>
                ),
              }}>
              <OwnerLabel hasPermission={false} owners={query.owners} />
            </ExpandableCard>
          </Col>
          <Col span={24}>
            <DescriptionV1
              wrapInCard
              className="w-full"
              description={query?.description || ''}
              entityFullyQualifiedName={query?.fullyQualifiedName}
              entityType={EntityType.QUERY}
              hasEditAccess={EditDescription || EditAll}
              showCommentsIcon={false}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </Col>
          <Col span={24}>
            <TagsContainerV2
              newLook
              permission={EditAll || EditTags}
              selectedTags={query?.tags || []}
              showTaskHandler={false}
              tagType={TagSource.Classification}
              onSelectionChange={handleTagSelection}
            />
          </Col>
          <Col span={24}>
            <ExpandableCard
              cardProps={{
                title: (
                  <Typography.Text
                    className="right-panel-label"
                    data-testid="users">
                    {t('label.user-plural')}
                  </Typography.Text>
                ),
              }}>
              {query.users && query.users.length ? (
                <Space wrap size={6}>
                  {query.users.map((user) => (
                    <Space className="m-r-xss" key={user.id} size={4}>
                      <ProfilePicture
                        displayName={getEntityName(user)}
                        name={user.name || ''}
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
            </ExpandableCard>
          </Col>
          <Col span={24}>
            <ExpandableCard
              cardProps={{
                title: (
                  <Typography.Text
                    className="right-panel-label"
                    data-testid="used-by">
                    {t('label.used-by')}
                  </Typography.Text>
                ),
              }}>
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
            </ExpandableCard>
          </Col>
        </Row>
      )}
    </Drawer>
  );
};

export default TableQueryRightPanel;
