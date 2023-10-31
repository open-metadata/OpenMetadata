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

import { Button, Col, Modal, Row, Space, Switch, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconDelete } from '../../assets/svg/ic-delete.svg';
import { ReactComponent as IconRestore } from '../../assets/svg/ic-restore.svg';
import FilterTablePlaceHolder from '../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import Table from '../../components/common/Table/Table';
import { PAGE_SIZE_BASE, ROUTES } from '../../constants/constants';
import { ADMIN_ONLY_ACTION } from '../../constants/HelperTextUtil';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { CreateUser } from '../../generated/api/teams/createUser';
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { updateUser } from '../../rest/userAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { commonUserDetailColumns } from '../../utils/Users.util';
import DeleteWidgetModal from '../common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../common/SearchBar/SearchBar.component';
import PageHeader from '../PageHeader/PageHeader.component';
import './users-list.less';

interface UserListV1Props {
  data: User[];
  paging: Paging;
  searchTerm: string;
  currentPage: number;
  isDataLoading: boolean;
  showDeletedUser: boolean;
  onPagingChange: NextPreviousProps['pagingHandler'];
  onShowDeletedUserChange: (value: boolean) => void;
  onSearch: (text: string) => void;
  afterDeleteAction: () => void;
  isAdminPage: boolean | undefined;
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
  isAdminPage,
}) => {
  const { isAdminUser } = useAuth();
  const { t } = useTranslation();
  const history = useHistory();
  const [selectedUser, setSelectedUser] = useState<User>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReactiveModal, setShowReactiveModal] = useState(false);
  const showRestore = showDeletedUser && !isDataLoading;
  const [isLoading, setIsLoading] = useState(false);

  const handleAddNewUser = () => {
    history.push(ROUTES.CREATE_USER);
  };

  const handleReactiveUser = async () => {
    if (isUndefined(selectedUser)) {
      return;
    }
    setIsLoading(true);
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
          t('message.entity-restored-success', { entity: t('label.user') })
        );
        setShowReactiveModal(false);
      } else {
        throw t('server.entity-updating-error', { entity: t('label.user') });
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', { entity: t('label.user') })
      );
    } finally {
      setIsLoading(false);
    }
    setSelectedUser(undefined);
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
            className="w-full justify-center action-icons"
            size={8}>
            {showRestore && (
              <Tooltip placement="bottom" title={t('label.restore')}>
                <Button
                  data-testid={`restore-user-btn-${record.name}`}
                  icon={<IconRestore name={t('label.restore')} width="16px" />}
                  type="text"
                  onClick={() => {
                    setSelectedUser(record);
                    setShowReactiveModal(true);
                  }}
                />
              </Tooltip>
            )}
            <Tooltip placement="left" title={!isAdminUser && ADMIN_ONLY_ACTION}>
              <Button
                disabled={!isAdminUser}
                icon={
                  <IconDelete
                    data-testid={`delete-user-btn-${
                      record.displayName || record.name
                    }`}
                    name={t('label.delete')}
                    width="16px"
                  />
                }
                size="small"
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

  const errorPlaceHolder = useMemo(
    () => (
      <Row>
        <Col className="w-full d-flex justify-end">
          <span>
            <Switch
              checked={showDeletedUser}
              data-testid="show-deleted"
              onClick={onShowDeletedUserChange}
            />
            <span className="m-l-xs">{t('label.deleted')}</span>
          </span>
        </Col>
        <Col className="mt-24" span={24}>
          <ErrorPlaceHolder
            heading={t('label.user')}
            permission={isAdminUser}
            type={ERROR_PLACEHOLDER_TYPE.CREATE}
            onClick={handleAddNewUser}
          />
        </Col>
      </Row>
    ),
    [isAdminUser, showDeletedUser]
  );

  if (isEmpty(data) && !showDeletedUser && !isDataLoading && !searchTerm) {
    return errorPlaceHolder;
  }

  return (
    <Row
      className="user-listing p-b-md"
      data-testid="user-list-v1-component"
      gutter={[16, 16]}>
      <Col span={12}>
        <PageHeader
          data={isAdminPage ? PAGE_HEADERS.ADMIN : PAGE_HEADERS.USERS}
        />
      </Col>
      <Col span={12}>
        <Space align="center" className="w-full justify-end" size={16}>
          <span>
            <Switch
              checked={showDeletedUser}
              data-testid="show-deleted"
              onClick={onShowDeletedUserChange}
            />
            <span className="m-l-xs">{t('label.deleted')}</span>
          </span>

          {isAdminUser && (
            <Button
              data-testid="add-user"
              type="primary"
              onClick={handleAddNewUser}>
              {t('label.add-entity', { entity: t('label.user') })}
            </Button>
          )}
        </Space>
      </Col>
      <Col span={8}>
        <Searchbar
          removeMargin
          placeholder={`${t('label.search-for-type', {
            type: t('label.user'),
          })}...`}
          searchValue={searchTerm}
          typingInterval={500}
          onSearch={onSearch}
        />
      </Col>

      <Col span={24}>
        <Table
          bordered
          className="user-list-table"
          columns={columns}
          data-testid="user-list-table"
          dataSource={data}
          loading={isDataLoading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Col>
      <Col span={24}>
        {paging.total > PAGE_SIZE_BASE && (
          <NextPrevious
            currentPage={currentPage}
            isNumberBased={Boolean(searchTerm)}
            pageSize={PAGE_SIZE_BASE}
            paging={paging}
            pagingHandler={onPagingChange}
          />
        )}
      </Col>

      <Modal
        cancelButtonProps={{
          type: 'link',
        }}
        className="reactive-modal"
        closable={false}
        confirmLoading={isLoading}
        maskClosable={false}
        okText={t('label.restore')}
        open={showReactiveModal}
        title={t('label.restore-entity', {
          entity: t('label.user'),
        })}
        onCancel={() => {
          setShowReactiveModal(false);
          setSelectedUser(undefined);
        }}
        onOk={handleReactiveUser}>
        <p>
          {t('message.are-you-want-to-restore', {
            entity: getEntityName(selectedUser),
          })}
        </p>
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
