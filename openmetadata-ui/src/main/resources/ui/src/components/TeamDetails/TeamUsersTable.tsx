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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Col, Row, Space, Tooltip } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import Searchbar from 'components/common/searchbar/Searchbar';
import { UserSelectableList } from 'components/common/UserSelectableList/UserSelectableList.component';
import Loader from 'components/Loader/Loader';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { Team } from 'generated/entity/teams/team';
import { Paging } from 'generated/type/paging';
import { isEmpty, orderBy } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconRemove } from '../../assets/svg/ic-remove.svg';
import { PAGE_SIZE_MEDIUM } from '../../constants/constants';
import { User } from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import { fetchErrorPlaceHolder } from '../../utils/TeamDetails.utils';
import { commonUserDetailColumns } from '../Users/Users.util';

interface TeamUsersTableProps {
  currentTeamUsers: User[];
  currentTeamUserPage: number;
  teamUsersSearchText: string;
  handleTeamUsersSearchAction: (text: string) => void;
  teamUserPagingHandler: (
    cursorValue: string | number,
    activePage?: number | undefined
  ) => void;
  handleAddUser: (data: EntityReference[]) => void;
  deleteUserHandler: (id: string, leave?: boolean) => void;
  entityPermissions: OperationPermission;
  isTeamMemberLoading: number;
  currentTeam: Team;
  isActionAllowed: boolean;
  teamUserPaging: Paging;
}

function TeamUsersTable({
  currentTeamUsers,
  currentTeamUserPage,
  teamUsersSearchText,
  handleTeamUsersSearchAction,
  teamUserPagingHandler,
  handleAddUser,
  deleteUserHandler,
  entityPermissions,
  isTeamMemberLoading,
  currentTeam,
  isActionAllowed,
  teamUserPaging,
}: TeamUsersTableProps) {
  const { t } = useTranslation();
  const sortedUser = orderBy(currentTeamUsers || [], ['name'], 'asc');

  const columns: ColumnsType<User> = useMemo(() => {
    return [
      ...commonUserDetailColumns(),
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 90,
        render: (_, record) => (
          <Space
            align="center"
            className="w-full justify-center remove-icon"
            size={8}>
            <Tooltip
              placement="bottomRight"
              title={
                entityPermissions.EditAll
                  ? t('label.remove')
                  : t('message.no-permission-for-action')
              }>
              <Button
                data-testid="remove-user-btn"
                disabled={!entityPermissions.EditAll}
                icon={
                  <IconRemove height={16} name={t('label.remove')} width={16} />
                }
                type="text"
                onClick={() => deleteUserHandler(record.id)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];
  }, [deleteUserHandler]);

  return (
    <>
      {isEmpty(currentTeamUsers) &&
      !teamUsersSearchText &&
      isTeamMemberLoading <= 0 ? (
        fetchErrorPlaceHolder({
          type: ERROR_PLACEHOLDER_TYPE.ASSIGN,
          permission: entityPermissions.EditAll,
          heading: t('label.user'),
          button: (
            <UserSelectableList
              hasPermission
              selectedUsers={currentTeam.users ?? []}
              onUpdate={handleAddUser}>
              <Button
                ghost
                className="p-x-lg"
                data-testid="add-new-user"
                icon={<PlusOutlined />}
                title={
                  entityPermissions.EditAll
                    ? t('label.add-new-entity', { entity: t('label.user') })
                    : t('message.no-permission-for-action')
                }
                type="primary">
                {t('label.add')}
              </Button>
            </UserSelectableList>
          ),
        })
      ) : (
        <>
          <Row className="justify-between m-b-sm" justify="space-between">
            <Col className="w-4/12">
              <Searchbar
                removeMargin
                placeholder={t('label.search-for-type', {
                  type: t('label.user-lowercase'),
                })}
                searchValue={teamUsersSearchText}
                typingInterval={500}
                onSearch={handleTeamUsersSearchAction}
              />
            </Col>

            <Col>
              {currentTeamUsers.length > 0 && isActionAllowed && (
                <UserSelectableList
                  hasPermission
                  selectedUsers={currentTeam.users ?? []}
                  onUpdate={handleAddUser}>
                  <Button
                    data-testid="add-new-user"
                    disabled={!entityPermissions.EditAll}
                    title={
                      entityPermissions.EditAll
                        ? t('label.add-entity', { entity: t('label.user') })
                        : t('message.no-permission-for-action')
                    }
                    type="primary">
                    {t('label.add-entity', { entity: t('label.user') })}
                  </Button>
                </UserSelectableList>
              )}
            </Col>
          </Row>

          {isTeamMemberLoading > 0 ? (
            <Loader />
          ) : (
            <div>
              <Table
                bordered
                className="teams-list-table"
                columns={columns}
                dataSource={sortedUser}
                locale={{
                  emptyText: <FilterTablePlaceHolder />,
                }}
                pagination={false}
                rowKey="name"
                size="small"
              />
              {teamUserPaging.total > PAGE_SIZE_MEDIUM && (
                <NextPrevious
                  currentPage={currentTeamUserPage}
                  isNumberBased={Boolean(teamUsersSearchText)}
                  pageSize={PAGE_SIZE_MEDIUM}
                  paging={teamUserPaging}
                  pagingHandler={teamUserPagingHandler}
                  totalCount={teamUserPaging.total}
                />
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default TeamUsersTable;
