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
import { capitalize, isEmpty, noop } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import IconDelete from '../../assets/svg/ic-delete.svg?react';
import IconRestore from '../../assets/svg/ic-restore.svg?react';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../components/common/Table/Table';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { INITIAL_PAGING_VALUE, ROUTES } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { ADMIN_ONLY_ACTION } from '../../constants/HelperTextUtil';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { User } from '../../generated/entity/teams/user';
import { Include } from '../../generated/type/include';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useAuth } from '../../hooks/authHooks';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { usePaging } from '../../hooks/paging/usePaging';
import { useTableFilters } from '../../hooks/useTableFilters';
import { searchData } from '../../rest/miscAPI';
import { getUsers, restoreUser, UsersQueryParams } from '../../rest/userAPI';
import { Transi18next } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { commonUserDetailColumns } from '../../utils/Users.util';
import './user-list-page-v1.less';

const UserListPageV1 = () => {
  const { t } = useTranslation();
  const { tab } = useRequiredParams<{ tab: GlobalSettingOptions }>();
  const {
    preferences: { globalPageSize },
  } = useCurrentUserPreferences();
  const navigate = useNavigate();
  const isAdminPage = useMemo(() => tab === GlobalSettingOptions.ADMINS, [tab]);
  const { isAdminUser } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [userList, setUserList] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReactiveModal, setShowReactiveModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const {
    filters: { isDeleted, user: searchValue },
    setFilters,
  } = useTableFilters({
    isDeleted: false,
    user: '',
  });

  const showRestore = isDeleted && !isDataLoading;

  const { getResourceLimit } = useLimitStore();
  const {
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    pageSize,
    paging,
    showPagination,
  } = usePaging();

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.MEMBERS,
        capitalize(tab)
      ),
    [tab]
  );

  const fetchUsersList = async (params: UsersQueryParams) => {
    setIsDataLoading(true);
    try {
      const { data, paging: userPaging } = await getUsers({
        isBot: false,
        fields: [
          TabSpecificField.PROFILE,
          TabSpecificField.TEAMS,
          TabSpecificField.ROLES,
        ].join(','),
        limit: pageSize,
        ...params,
      });
      setUserList(data);
      handlePagingChange(userPaging);
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

  const userQuerySearch = (
    text = WILD_CARD_CHAR,
    currentPage = 1,
    isAdmin = false,
    isDeleted = false
  ) => {
    let filters = 'isAdmin:false isBot:false';
    if (isAdmin) {
      filters = 'isAdmin:true isBot:false';
    }

    return new Promise<Array<User>>((resolve) => {
      searchData(
        text,
        currentPage,
        pageSize,
        filters,
        '',
        '',
        SearchIndex.USER,
        isDeleted
      )
        .then((res) => {
          const data = res.data.hits.hits.map(({ _source }) => _source);
          handlePagingChange({
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

    userQuerySearch(value, pageNumber, isAdminPage, isDeleted).then(
      (resUsers) => {
        setUserList(resUsers);
        setIsDataLoading(false);
      }
    );
  };

  const handleUserPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (searchValue) {
        handlePageChange(currentPage);
        getSearchedUsers(searchValue, currentPage);
      } else if (cursorType && paging[cursorType]) {
        handlePageChange(currentPage);
        fetchUsersList({
          isAdmin: isAdminPage,
          [cursorType]: paging[cursorType],
          include: isDeleted ? Include.Deleted : Include.NonDeleted,
        });
      }
    },
    [
      isAdminPage,
      paging,
      pageSize,
      setFilters,
      handlePageChange,
      fetchUsersList,
      getSearchedUsers,
      isDeleted,
    ]
  );

  const handleShowDeletedUserChange = (value: boolean) => {
    handlePageChange(INITIAL_PAGING_VALUE);
    handlePageSizeChange(globalPageSize);
    // Clear search value, on Toggle delete
    setFilters({ isDeleted: value || null, user: null });
  };

  const handleSearch = (value: string) => {
    handlePageChange(INITIAL_PAGING_VALUE);

    setFilters({ user: isEmpty(value) ? null : value });
  };

  useEffect(() => {
    // Perform reset
    setFilters({});
    setIsDataLoading(true);
    handlePageChange(INITIAL_PAGING_VALUE);
    handlePageSizeChange(globalPageSize);
  }, [isAdminPage]);

  useEffect(() => {
    if (searchValue) {
      getSearchedUsers(searchValue, 1);
    } else {
      fetchUsersList({
        isAdmin: isAdminPage,
        include: isDeleted ? Include.Deleted : Include.NonDeleted,
      });
    }
  }, [pageSize, isAdminPage, searchValue, isDeleted]);

  const handleAddNewUser = () => {
    navigate(ROUTES.CREATE_USER, {
      state: { isAdminPage },
      replace: false,
    });
  };

  const handleReactiveUser = async () => {
    if (!selectedUser) {
      return;
    }
    setIsLoading(true);

    try {
      const data = await restoreUser(selectedUser.id);
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
    const commonFields = isAdminPage
      ? commonUserDetailColumns().filter((col) => col.key !== 'roles')
      : commonUserDetailColumns();

    return [
      ...commonFields,
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
              <Tooltip
                placement={isAdminUser ? 'bottom' : 'left'}
                title={
                  isAdminUser
                    ? t('label.restore-entity', {
                        entity: t('label.user'),
                      })
                    : ADMIN_ONLY_ACTION
                }>
                <Button
                  data-testid={`restore-user-btn-${record.name}`}
                  disabled={!isAdminUser}
                  icon={<IconRestore name={t('label.restore')} width="16px" />}
                  type="text"
                  onClick={() => {
                    setSelectedUser(record);
                    setShowReactiveModal(true);
                  }}
                />
              </Tooltip>
            )}
            <Tooltip
              placement={isAdminUser ? 'bottom' : 'left'}
              title={
                isAdminUser
                  ? t('label.delete-entity', {
                      entity: t('label.user'),
                    })
                  : ADMIN_ONLY_ACTION
              }>
              <Button
                disabled={!isAdminUser}
                icon={
                  <IconDelete
                    data-testid={`delete-user-btn-${record.name}`}
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
      <ErrorPlaceHolder
        className="border-none m-y-md"
        heading={t('label.user')}
        permission={isAdminUser}
        permissionValue={t('label.create-entity', {
          entity: t('label.user'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.CREATE}
        onClick={handleAddNewUser}
      />
    ),
    [isAdminUser]
  );

  const emptyPlaceHolderText = useMemo(() => {
    if (searchValue) {
      return (
        <Transi18next
          i18nKey={
            isAdminPage
              ? 'message.no-admin-available-with-name'
              : 'message.no-user-available-with-name'
          }
          renderElement={
            <Link
              to={getSettingPath(
                GlobalSettingsMenuCategory.MEMBERS,
                isAdminPage
                  ? GlobalSettingOptions.USERS
                  : GlobalSettingOptions.ADMINS
              )}
            />
          }
          values={{
            searchText: searchValue,
          }}
        />
      );
    }

    return (
      <Transi18next
        i18nKey={
          isAdminPage
            ? 'message.no-admin-available-with-filters'
            : 'message.no-user-available-with-filters'
        }
        renderElement={
          <Link
            to={getSettingPath(
              GlobalSettingsMenuCategory.MEMBERS,
              isAdminPage
                ? GlobalSettingOptions.USERS
                : GlobalSettingOptions.ADMINS
            )}
          />
        }
      />
    );
  }, [isAdminPage, searchValue]);

  const tablePlaceholder = useMemo(() => {
    return isEmpty(userList) && !isDeleted && !isDataLoading && !searchValue ? (
      errorPlaceHolder
    ) : (
      <FilterTablePlaceHolder placeholderText={emptyPlaceHolderText} />
    );
  }, [
    userList,
    isDeleted,
    isDataLoading,
    searchValue,
    errorPlaceHolder,
    emptyPlaceHolderText,
  ]);

  if (
    ![GlobalSettingOptions.USERS, GlobalSettingOptions.ADMINS].includes(
      tab as GlobalSettingOptions
    )
  ) {
    // This component is not accessible for the given tab
    return <Navigate to={ROUTES.NOT_FOUND} />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.user-plural')}>
      <Row
        className="user-listing p-b-md"
        data-testid="user-list-v1-component"
        gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={12}>
          <PageHeader
            data={isAdminPage ? PAGE_HEADERS.ADMIN : PAGE_HEADERS.USERS}
          />
        </Col>
        <Col span={12}>
          <Space align="center" className="w-full justify-end" size={16}>
            {isAdminUser && (
              <LimitWrapper resource="user">
                <Button
                  data-testid="add-user"
                  type="primary"
                  onClick={handleAddNewUser}>
                  {t('label.add-entity', {
                    entity: t(`label.${isAdminPage ? 'admin' : 'user'}`),
                  })}
                </Button>
              </LimitWrapper>
            )}
          </Space>
        </Col>

        <Col span={24}>
          <Table
            className="user-list-table"
            columns={columns}
            customPaginationProps={{
              currentPage,
              isLoading: isDataLoading,
              showPagination,
              isNumberBased: Boolean(searchValue),
              pageSize,
              paging,
              pagingHandler: handleUserPageChange,
              onShowSizeChange: handlePageSizeChange,
            }}
            data-testid="user-list-table"
            dataSource={userList}
            extraTableFilters={
              <span>
                <Switch
                  checked={isDeleted}
                  data-testid="show-deleted"
                  onClick={handleShowDeletedUserChange}
                />
                <span className="m-l-xs">{t('label.deleted')}</span>
              </span>
            }
            loading={isDataLoading}
            locale={{
              emptyText: tablePlaceholder,
            }}
            pagination={false}
            rowKey="id"
            searchProps={{
              placeholder: `${t('label.search-for-type', {
                type: t('label.user'),
              })}...`,
              value: searchValue,
              typingInterval: 400,
              urlSearchKey: 'user',
              onSearch: noop,
            }}
            size="small"
          />
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
          afterDeleteAction={async () => {
            handleSearch('');
            // Update current count when Create / Delete operation performed
            await getResourceLimit('user', true, true);
          }}
          allowSoftDelete={!isDeleted}
          entityId={selectedUser?.id || ''}
          entityName={getEntityName(selectedUser)}
          entityType={EntityType.USER}
          visible={showDeleteModal}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedUser(undefined);
          }}
        />
      </Row>
    </PageLayoutV1>
  );
};

export default UserListPageV1;
