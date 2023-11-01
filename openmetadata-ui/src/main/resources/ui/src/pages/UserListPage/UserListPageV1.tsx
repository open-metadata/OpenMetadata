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

import { Button, Col, Modal, Row, Space, Switch, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { data } from 'autoprefixer';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { ReactComponent as IconDelete } from '../../assets/svg/ic-delete.svg';
import { ReactComponent as IconRestore } from '../../assets/svg/ic-restore.svg';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../components/common/SearchBarComponent/SearchBar.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  pagingObject,
  ROUTES,
} from '../../constants/constants';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { ADMIN_ONLY_ACTION } from '../../constants/HelperTextUtil';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import { CreateUser } from '../../generated/api/teams/createUser';
import { User } from '../../generated/entity/teams/user';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { searchData } from '../../rest/miscAPI';
import { getUsers, updateUser, UsersQueryParams } from '../../rest/userAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { commonUserDetailColumns } from '../../utils/Users.util';
import './user-list-page-v1.less';

const teamsAndUsers = [GlobalSettingOptions.USERS, GlobalSettingOptions.ADMINS];

const UserListPageV1 = () => {
  const { t } = useTranslation();
  const { tab } = useParams<{ [key: string]: GlobalSettingOptions }>();
  const history = useHistory();
  const location = useLocation();
  const { isAdminUser } = useAuth();
  const [isAdminPage, setIsAdminPage] = useState<boolean | undefined>(
    tab === GlobalSettingOptions.ADMINS || undefined
  );

  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [showDeletedUser, setShowDeletedUser] = useState<boolean>(false);
  const [userList, setUserList] = useState<User[]>([]);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [searchValue, setSearchValue] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);

  const initialSetup = () => {
    setIsAdminPage(tab === GlobalSettingOptions.ADMINS || undefined);
    setIsDataLoading(true);
    setShowDeletedUser(false);
    setSearchValue('');
    setCurrentPage(INITIAL_PAGING_VALUE);
  };

  const fetchUsersList = async (params: UsersQueryParams) => {
    setIsDataLoading(true);
    try {
      const { data, paging } = await getUsers({
        isBot: false,
        limit: PAGE_SIZE_BASE,
        fields: 'profile,teams,roles',
        ...params,
      });
      if (data) {
        setUserList(data);
        setPaging(paging);
      } else {
        throw t('server.entity-fetch-error', {
          entity: t('label.user'),
        });
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.user'),
        })
      );
    }
    setIsDataLoading(false);
  };

  const handleFetch = () => {
    fetchUsersList({
      isAdmin: isAdminPage,
      include: showDeletedUser ? Include.Deleted : Include.NonDeleted,
    });
  };

  const userQuerySearch = (
    text = WILD_CARD_CHAR,
    currentPage = 1,
    isAdmin = false,
    isDeleted = false
  ) => {
    let filters = 'isBot:false';
    if (isAdmin) {
      filters = 'isAdmin:true isBot:false';
    }

    return new Promise<Array<User>>((resolve) => {
      searchData(
        text,
        currentPage,
        PAGE_SIZE_BASE,
        filters,
        '',
        '',
        SearchIndex.USER,
        isDeleted
      )
        .then((res) => {
          const data = res.data.hits.hits.map(({ _source }) => _source);
          setPaging({
            total: res.data.hits.total.value,
          });
          resolve(data);
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            t('server.entity-fetch-error', {
              entity: t('label.user'),
            })
          );
          resolve([]);
        });
    });
  };

  const getSearchedUsers = (value: string, pageNumber: number) => {
    setIsDataLoading(true);

    userQuerySearch(value, pageNumber, isAdminPage, showDeletedUser).then(
      (resUsers) => {
        setUserList(resUsers);
        setIsDataLoading(false);
      }
    );
  };

  const handlePagingChange = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (searchValue) {
      setCurrentPage(currentPage);
      getSearchedUsers(searchValue, currentPage);
    } else if (cursorType && paging[cursorType]) {
      setCurrentPage(currentPage);
      fetchUsersList({
        isAdmin: isAdminPage,
        [cursorType]: paging[cursorType],
        include: showDeletedUser ? Include.Deleted : Include.NonDeleted,
      });
    }
  };

  const handleShowDeletedUserChange = (value: boolean) => {
    setCurrentPage(INITIAL_PAGING_VALUE);
    setSearchValue('');
    setShowDeletedUser(value);
    fetchUsersList({
      isAdmin: isAdminPage,
      include: value ? Include.Deleted : Include.NonDeleted,
    });
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setCurrentPage(INITIAL_PAGING_VALUE);
    const params = new URLSearchParams({ user: value });
    // This function is called onChange in the search input with debouncing
    // Hence using history.replace instead of history.push to avoid adding multiple routes in history
    history.replace({
      pathname: location.pathname,
      search: value && params.toString(),
    });
    if (value) {
      getSearchedUsers(value, INITIAL_PAGING_VALUE);
    } else {
      handleFetch();
    }
  };

  useEffect(() => {
    initialSetup();
    if (teamsAndUsers.includes(tab)) {
      // Checking if the path has search query present in it
      // if present fetch userlist with the query
      // else get list of all users
      if (location.search) {
        // Converting string to URLSearchParameter
        const searchParameter = new URLSearchParams(location.search);
        // Getting the searched name
        const userSearchTerm = searchParameter.get('user') || '';
        setSearchValue(userSearchTerm);
        getSearchedUsers(userSearchTerm, 1);
        setIsDataLoading(false);
      } else {
        fetchUsersList({
          isAdmin: tab === GlobalSettingOptions.ADMINS || undefined,
        });
      }
    } else {
      setIsDataLoading(false);
    }
  }, [tab]);

  const [selectedUser, setSelectedUser] = useState<User>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReactiveModal, setShowReactiveModal] = useState(false);
  const showRestore = showDeletedUser && !isDataLoading;
  const [isLoading, setIsLoading] = useState(false);

  const handleAddNewUser = () => {
    history.push(ROUTES.CREATE_USER);
  };

  const handleReactiveUser = async () => {
    if (!selectedUser) {
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
        handleSearch('');
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
              onClick={handleShowDeletedUserChange}
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

  if (isEmpty(data) && !showDeletedUser && !isDataLoading && !searchValue) {
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
              onClick={handleShowDeletedUserChange}
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
          searchValue={searchValue}
          typingInterval={500}
          onSearch={handleSearch}
        />
      </Col>

      <Col span={24}>
        <Table
          bordered
          className="user-list-table"
          columns={columns}
          data-testid="user-list-table"
          dataSource={userList}
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
            isNumberBased={Boolean(searchValue)}
            pageSize={PAGE_SIZE_BASE}
            paging={paging}
            pagingHandler={handlePagingChange}
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
        afterDeleteAction={() => handleSearch('')}
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

export default UserListPageV1;
