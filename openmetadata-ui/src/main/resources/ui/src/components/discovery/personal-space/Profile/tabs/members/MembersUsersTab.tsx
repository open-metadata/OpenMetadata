/*
 *  Copyright 2026 Collate.
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

import {
    Box,
    Button,
    Dropdown,
    EmptyPlaceholder,
    PaginationCardWithControls
} from '@openmetadata/ui-core-components';
import { Download01, Upload01 } from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PAGE_SIZE_BASE,
    PAGE_SIZE_LARGE,
    PAGE_SIZE_MEDIUM
} from '../../../../../../constants/constants';
import Table from '../../../../../common/Table/TableV2';
import { UserTeamSelectableList } from '../../../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import type { MembersUsersTabProps } from './MembersTeamDetail.types';

const MembersUsersTab: FC<MembersUsersTabProps> = ({
  team,
  userColumns,
  filteredTeamUsers,
  isTeamUsersLoading,
  usersSearchTerm,
  canEditAll,
  isGroupType,
  usersPage,
  usersPageSize,
  usersPaging,
  showUsersPagination,
  onUsersSearchTermChange,
  onAddUsers,
  onUsersExport,
  onNavigate,
  onTeamUsersPageNavigation,
  onUsersPageSizeChange,
}) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={3}>
      <Table
        columns={userColumns}
        data-testid="team-users-table"
        dataSource={filteredTeamUsers}
        extraTableFilters={
          <Box align="center" direction="row" gap={2}>
            {canEditAll && !team.deleted && (
              <UserTeamSelectableList
                hasPermission
                multiple={{ user: true, team: false }}
                owner={team.users ?? []}
                onUpdate={(users) => onAddUsers(users ?? [])}>
                <Button color="primary" data-testid="add-user" size="sm">
                  {t('label.add-entity', { entity: t('label.user') })}
                </Button>
              </UserTeamSelectableList>
            )}
            <Dropdown.Root>
              <Dropdown.DotsButton />
              <Dropdown.Popover className="tw:w-min">
                <Dropdown.Menu>
                  <Dropdown.Item
                    data-testid="export-users"
                    icon={Download01}
                    onAction={onUsersExport}>
                    {t('label.export-entity', {
                      entity: t('label.user-plural'),
                    })}
                  </Dropdown.Item>
                  {isGroupType && canEditAll && !team.deleted && (
                    <Dropdown.Item
                      data-testid="import-users"
                      icon={Upload01}
                      onAction={() =>
                        onNavigate({
                          type: 'teams-import',
                          fqn: team.name,
                          importType: 'users',
                        })
                      }>
                      {t('label.import-entity', {
                        entity: t('label.user-plural'),
                      })}
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </Box>
        }
        loading={isTeamUsersLoading}
        locale={{
          emptyText: (
            <Box
              align="center"
              className="tw:min-h-32 tw:relative"
              justify="center">
              <EmptyPlaceholder
                description={t(
                  'message.adding-new-entity-is-easy-just-give-it-a-spin',
                  { entity: t('label.user') }
                )}
                title={t('label.no-entity-found', {
                  entity: t('label.user-plural'),
                })}
              />
            </Box>
          ),
        }}
        pagination={false}
        rowKey="id"
        searchProps={{
          placeholder: t('label.search-for-type', {
            type: t('label.user-lowercase'),
          }),
          searchValue: usersSearchTerm,
          onSearch: onUsersSearchTermChange,
          typingInterval: 500,
        }}
        size="small"
      />
      {showUsersPagination && (
        <PaginationCardWithControls
          page={usersPage}
          pageSize={usersPageSize}
          pageSizeOptions={[PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE]}
          total={Math.max(
            1,
            Math.ceil((usersPaging.total ?? 0) / usersPageSize)
          )}
          onPageChange={onTeamUsersPageNavigation}
          onPageSizeChange={onUsersPageSizeChange}
        />
      )}
    </Box>
  );
};

export default MembersUsersTab;
