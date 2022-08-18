/*
 *  Copyright 2022 Collate
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

import { Button, Col, Modal, Row, Space, Switch, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { updateUser } from '../../axiosAPIs/userAPI';
import { getUserPath, PAGE_SIZE, ROUTES } from '../../constants/constants';
import { CreateUser } from '../../generated/api/teams/createUser';
import { EntityReference, User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import jsonData from '../../jsons/en';
import { getEntityName, getTeamsText } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import DeleteWidgetModal from '../common/DeleteWidget/DeleteWidgetModal';
import NextPrevious from '../common/next-previous/NextPrevious';
import Searchbar from '../common/searchbar/Searchbar';
import Loader from '../Loader/Loader';
import './usersList.less';

interface UserListV1Props {
  data: User[];
  paging: Paging;
  searchTerm: string;
  currentPage: number;
  isDataLoading: boolean;
  showDeletedUser: boolean;
  onPagingChange: (cursorValue: string | number, activePage?: number) => void;
  onShowDeletedUserChange: (value: boolean) => void;
  onSearch: (text: string) => void;
  afterDeleteAction: () => void;
}

const UserListV1: FC<UserListV1Props> = ({
  data,
  paging,
  searchTerm,
  currentPage,
  isDataLoading,
  showDeletedUser,
  onSearch,
  onShowDeletedUserChange,
  onPagingChange,
  afterDeleteAction,
}) => {
  const history = useHistory();
  const [selectedUser, setSelectedUser] = useState<User>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReactiveModal, setShowReactiveModal] = useState(false);
  const showRestore = showDeletedUser && !isDataLoading;

  const handleAddNewUser = () => {
    history.push(ROUTES.CREATE_USER);
  };

  const handleReactiveUser = async () => {
    if (isUndefined(selectedUser)) {
      return;
    }

    const updatedUserData: CreateUser = {
      description: selectedUser.description,
      displayName: selectedUser.displayName,
      email: selectedUser.email,
      isAdmin: selectedUser.isAdmin,
      name: selectedUser.name,
      profile: selectedUser.profile,
      roles: selectedUser.roles?.map((role) => role.id),
      teams: selectedUser.teams?.map((team) => team.id),
    };

    try {
      const { data } = await updateUser(updatedUserData);
      if (data) {
        afterDeleteAction();
        showSuccessToast(
          jsonData['api-success-messages']['user-restored-success']
        );
      } else {
        throw jsonData['api-error-messages']['update-user-error'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-user-error']
      );
    }
    setSelectedUser(undefined);
    setShowReactiveModal(false);
  };

  const columns: ColumnsType<User> = useMemo(() => {
    return [
      {
        title: 'Username',
        dataIndex: 'username',
        key: 'username',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getUserPath(record.fullyQualifiedName || record.name)}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
      },
      {
        title: 'Teams',
        dataIndex: 'teams',
        key: 'teams',
        render: (teams: EntityReference[]) => getTeamsText(teams),
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        key: 'actions',
        width: 90,
        render: (_, record) => (
          <Space
            align="center"
            className="tw-w-full tw-justify-center"
            size={8}>
            {showRestore && (
              <Tooltip placement="bottom" title="Restore">
                <Button
                  icon={
                    <SVGIcons
                      alt="Restore"
                      className="tw-w-4"
                      icon={Icons.RESTORE}
                    />
                  }
                  type="text"
                  onClick={() => {
                    setSelectedUser(record);
                    setShowReactiveModal(true);
                  }}
                />
              </Tooltip>
            )}
            <Tooltip placement="bottom" title="Delete">
              <Button
                icon={
                  <SVGIcons
                    alt="Delete"
                    className="tw-w-4"
                    icon={Icons.DELETE}
                  />
                }
                type="text"
                onClick={() => {
                  setSelectedUser(record);
                  setShowDeleteModal(true);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];
  }, [showRestore]);

  return (
    <Row className="user-listing" gutter={[16, 16]}>
      <Col span={8}>
        <Searchbar
          removeMargin
          placeholder="Search for user..."
          searchValue={searchTerm}
          typingInterval={500}
          onSearch={onSearch}
        />
      </Col>
      <Col span={16}>
        <Space align="center" className="tw-w-full tw-justify-end" size={16}>
          <span>
            <Switch
              checked={showDeletedUser}
              size="small"
              onClick={onShowDeletedUserChange}
            />
            <span className="tw-ml-2">Deleted Users</span>
          </span>
          <Button type="primary" onClick={handleAddNewUser}>
            Add User
          </Button>
        </Space>
      </Col>

      <Col span={24}>
        <Table
          className="user-list-table"
          columns={columns}
          dataSource={data}
          loading={{
            spinning: isDataLoading,
            indicator: <Loader size="small" />,
          }}
          pagination={false}
          size="small"
        />
      </Col>
      <Col span={24}>
        {paging.total > PAGE_SIZE && (
          <NextPrevious
            currentPage={currentPage}
            isNumberBased={Boolean(searchTerm)}
            pageSize={PAGE_SIZE}
            paging={paging}
            pagingHandler={onPagingChange}
            totalCount={paging.total}
          />
        )}
      </Col>

      <Modal
        cancelButtonProps={{
          type: 'link',
        }}
        className="reactive-modal"
        okText="Restore"
        title="restore User"
        visible={showReactiveModal}
        onCancel={() => {
          setShowReactiveModal(false);
          setSelectedUser(undefined);
        }}
        onOk={handleReactiveUser}>
        <p>Are you sure you want to restore {getEntityName(selectedUser)}?</p>
      </Modal>

      <DeleteWidgetModal
        afterDeleteAction={afterDeleteAction}
        allowSoftDelete={!showDeletedUser}
        entityId={selectedUser?.id || ''}
        entityName={selectedUser?.name || ''}
        entityType="user"
        visible={showDeleteModal}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedUser(undefined);
        }}
      />
    </Row>
  );
};

export default UserListV1;
