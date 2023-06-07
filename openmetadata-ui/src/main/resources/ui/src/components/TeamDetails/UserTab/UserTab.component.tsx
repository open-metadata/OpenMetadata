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
import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Modal,
  Row,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ReactComponent as IconRemove } from 'assets/svg/ic-remove.svg';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import Searchbar from 'components/common/searchbar/Searchbar';
import { UserSelectableList } from 'components/common/UserSelectableList/UserSelectableList.component';
import Loader from 'components/Loader/Loader';
import { commonUserDetailColumns } from 'components/Users/Users.util';
import { PAGE_SIZE_MEDIUM } from 'constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { User } from 'generated/entity/teams/user';
import { EntityReference } from 'generated/entity/type';
import { isEmpty, orderBy } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from 'utils/EntityUtils';
import { UserTabProps } from './UserTab.interface';

export const UserTab = ({
  users,
  searchText,
  isLoading,
  permission,
  currentTeam,
  onUsersSearch,
  onAddUser,
  paging,
  onChangePaging,
  currentPage,
  onRemoveUser,
}: UserTabProps) => {
  const { t } = useTranslation();
  const [deletingUser, setDeletingUser] = useState<EntityReference>();
  const deleteUserHandler = (id: string) => {
    const user = [...(currentTeam?.users ?? [])].find((u) => u.id === id);
    setDeletingUser(user);
  };

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
            className="tw-w-full tw-justify-center remove-icon"
            size={8}>
            <Tooltip
              placement="bottomRight"
              title={
                permission.EditAll
                  ? t('label.remove')
                  : t('message.no-permission-for-action')
              }>
              <Button
                data-testid="remove-user-btn"
                disabled={!permission.EditAll}
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

  const sortedUser = orderBy(users || [], ['name'], 'asc');

  const handleRemoveUser = () => {
    onRemoveUser(deletingUser?.id as string).then(() => {
      setDeletingUser(undefined);
    });
  };

  if (isEmpty(users) && !searchText && isLoading <= 0) {
    return (
      <ErrorPlaceHolder
        button={
          <UserSelectableList
            hasPermission
            selectedUsers={currentTeam.users ?? []}
            onUpdate={onAddUser}>
            <Button
              ghost
              className="p-x-lg"
              data-testid="add-new-user"
              icon={<PlusOutlined />}
              title={
                permission.EditAll
                  ? t('label.add-new-entity', { entity: t('label.user') })
                  : t('message.no-permission-for-action')
              }
              type="primary">
              {t('label.add')}
            </Button>
          </UserSelectableList>
        }
        className="mt-0-important"
        heading={t('label.user')}
        permission={permission.EditAll}
        type={ERROR_PLACEHOLDER_TYPE.ASSIGN}
      />
    );
  }

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Row justify="space-between">
          <Col span={8}>
            <Searchbar
              removeMargin
              placeholder={t('label.search-for-type', {
                type: t('label.user-lowercase'),
              })}
              searchValue={searchText}
              typingInterval={500}
              onSearch={onUsersSearch}
            />
          </Col>
          <Col>
            {users.length > 0 && permission.EditAll && (
              <UserSelectableList
                hasPermission
                selectedUsers={currentTeam.users ?? []}
                onUpdate={onAddUser}>
                <Button data-testid="add-new-user" type="primary">
                  {t('label.add-entity', { entity: t('label.user') })}
                </Button>
              </UserSelectableList>
            )}
          </Col>
        </Row>
      </Col>

      {isLoading > 0 ? (
        <Loader />
      ) : (
        <Col span={24}>
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
          {paging.total > PAGE_SIZE_MEDIUM && (
            <NextPrevious
              currentPage={currentPage}
              isNumberBased={Boolean(searchText)}
              pageSize={PAGE_SIZE_MEDIUM}
              paging={paging}
              pagingHandler={onChangePaging}
              totalCount={paging.total}
            />
          )}
        </Col>
      )}
      <Modal
        centered
        destroyOnClose
        closable={false}
        data-testid="confirmation-modal"
        maskClosable={false}
        open={Boolean(deletingUser)}
        title={
          <Typography.Text strong data-testid="modal-header">
            {t('label.removing-user')}
          </Typography.Text>
        }
        onCancel={() => setDeletingUser(undefined)}
        onOk={handleRemoveUser}>
        {t('message.are-you-sure-want-to-text', {
          text: t('label.remove-entity', {
            entity: getEntityName(deletingUser),
          }),
        })}
      </Modal>
    </Row>
  );
};
