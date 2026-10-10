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
import { Box, Grid, Owner, Typography } from '@openmetadata/ui-core-components';
import { Drawer } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconUser } from '../../../../assets/svg/user.svg';
import { EntityType } from '../../../../enums/entity.enum';
import { Query } from '../../../../generated/entity/data/query';
import { TagLabel, TagSource } from '../../../../generated/type/tagLabel';
import { useEntityRules } from '../../../../hooks/useEntityRules';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { getUserPath } from '../../../../utils/RouterUtils';
import Description from '../../../common/EntityDescription/Description';
import ExpandableCard from '../../../common/ExpandableCard/ExpandableCard';
import { EditIconButton } from '../../../common/IconButtons/EditIconButton';
import Loader from '../../../common/Loader/Loader';
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
  const { entityRules } = useEntityRules(EntityType.TABLE);
  // Derive named flags instead of destructuring raw EditAll/EditOwners/etc.
  // off `permission` — canEditOwners/canEditDescription/canEditTags already
  // fold the "field permission wins over EditAll" prioritization in.
  const { canEditOwners, canEditDescription, canEditTags } = useMemo(
    () => getDerivedPermissionFlags(permission),
    [permission]
  );

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
        <Grid
          className="layout-row layout-grid m-y-md p-x-md w-full"
          style={{ ...getLayoutGutter(16, 20) }}>
          <Grid.Item className="layout-column" span={24}>
            <ExpandableCard
              cardProps={{
                title: (
                  <Box
                    inline
                    align="center"
                    className="layout-space layout-space-horizontal w-full"
                    gap={0}
                    itemClassName="layout-space-item">
                    <Typography className="right-panel-label">
                      {t('label.owner-plural')}
                    </Typography>

                    {canEditOwners && (
                      <UserTeamSelectableList
                        hasPermission={canEditOwners}
                        multiple={{
                          user: entityRules.canAddMultipleUserOwners,
                          team: entityRules.canAddMultipleTeamOwner,
                        }}
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
                  </Box>
                ),
              }}>
              <Owner
                hasPermission={false}
                isCompactView={false}
                owners={query.owners}
                showLabel={false}
              />
            </ExpandableCard>
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <Description
              wrapInCard
              className="w-full"
              description={query?.description || ''}
              entityFullyQualifiedName={query?.fullyQualifiedName}
              entityType={EntityType.QUERY}
              hasEditAccess={canEditDescription}
              showCommentsIcon={false}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <TagsContainerV2
              newLook
              permission={canEditTags}
              selectedTags={query?.tags || []}
              showTaskHandler={false}
              tagType={TagSource.Classification}
              onSelectionChange={handleTagSelection}
            />
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <ExpandableCard
              cardProps={{
                title: (
                  <Typography className="right-panel-label" data-testid="users">
                    {t('label.user-plural')}
                  </Typography>
                ),
              }}>
              {query.users && query.users.length ? (
                <Box
                  inline
                  align="center"
                  className="layout-space layout-space-horizontal"
                  itemClassName="layout-space-item"
                  style={{ gap: 'var(--om-space-6)' }}
                  wrap="wrap">
                  {query.users.map((user) => (
                    <Box
                      inline
                      align="center"
                      className="layout-space layout-space-horizontal m-r-xss"
                      gap={1}
                      itemClassName="layout-space-item"
                      key={user.id}>
                      <ProfilePicture
                        displayName={getEntityName(user)}
                        name={user.name || ''}
                        width="20"
                      />
                      <Link to={getUserPath(user.name ?? '')}>
                        {getEntityName(user)}
                      </Link>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography as="p" className="m-b-0" color="secondary">
                  {t('label.no-entity', {
                    entity: t('label.user-plural'),
                  })}
                </Typography>
              )}
            </ExpandableCard>
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <ExpandableCard
              cardProps={{
                title: (
                  <Typography
                    className="right-panel-label"
                    data-testid="used-by">
                    {t('label.used-by')}
                  </Typography>
                ),
              }}>
              {query.usedBy && query.usedBy.length ? (
                <Box
                  inline
                  align="center"
                  className="layout-space layout-space-horizontal"
                  itemClassName="layout-space-item"
                  style={{ gap: 'var(--om-space-6)' }}
                  wrap="wrap">
                  {query.usedBy.map((user) => (
                    <Box
                      inline
                      align="center"
                      className="layout-space layout-space-horizontal m-r-xss"
                      gap={1}
                      itemClassName="layout-space-item"
                      key={user}>
                      <Icon component={IconUser} />
                      {user}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography as="p" className="m-b-0" color="secondary">
                  {t('label.no-entity', {
                    entity: t('label.used-by'),
                  })}
                </Typography>
              )}
            </ExpandableCard>
          </Grid.Item>
        </Grid>
      )}
    </Drawer>
  );
};

export default TableQueryRightPanel;
