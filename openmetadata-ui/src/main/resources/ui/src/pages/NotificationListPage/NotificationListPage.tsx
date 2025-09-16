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
import { Button, Col, Row, Skeleton, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/ic-delete.svg';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../components/common/Table/Table';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
} from '../../constants/constants';
import { ALERTS_DOCS } from '../../constants/docs.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../generated/events/eventSubscription';
import { Paging } from '../../generated/type/paging';
import LimitWrapper from '../../hoc/LimitWrapper';
import { usePaging } from '../../hooks/paging/usePaging';
import { getAlertsFromName, getAllAlerts } from '../../rest/alertsAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import {
  getNotificationAlertDetailsPath,
  getNotificationAlertsEditPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const NotificationListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadingCount, setLoadingCount] = useState(0);
  const [alerts, setAlerts] = useState<EventSubscription[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<EventSubscription>();
  const {
    pageSize,
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
    paging,
  } = usePaging();
  const { getResourceLimit } = useLimitStore();
  const { getEntityPermissionByFqn, getResourcePermission } =
    usePermissionProvider();
  const [alertPermissions, setAlertPermissions] = useState<
    {
      id: string;
      edit: boolean;
      delete: boolean;
    }[]
  >();
  const [alertResourcePermission, setAlertResourcePermission] =
    useState<OperationPermission>();

  const fetchAlertPermissionByFqn = async (alertDetails: EventSubscription) => {
    const permission = await getEntityPermissionByFqn(
      ResourceEntity.EVENT_SUBSCRIPTION,
      alertDetails.fullyQualifiedName ?? ''
    );

    const editPermission = permission.EditAll;
    const deletePermission = permission.Delete;

    return {
      id: alertDetails.id,
      edit: editPermission,
      delete: deletePermission,
    };
  };

  const fetchAlertResourcePermission = async () => {
    try {
      setLoadingCount((count) => count + 1);
      const permission = await getResourcePermission(
        ResourceEntity.EVENT_SUBSCRIPTION
      );

      setAlertResourcePermission(permission);
    } catch {
      // Error
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  const fetchAllAlertsPermission = async (alerts: EventSubscription[]) => {
    try {
      setLoadingCount((count) => count + 1);
      const response = alerts.map((alert) => fetchAlertPermissionByFqn(alert));

      setAlertPermissions(await Promise.all(response));
    } catch {
      // Error
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(GlobalSettingsMenuCategory.NOTIFICATIONS),
    []
  );

  const fetchAlerts = useCallback(
    async (params?: Partial<Paging>) => {
      setLoadingCount((count) => count + 1);
      try {
        const { data, paging } = await getAllAlerts({
          after: params?.after,
          before: params?.before,
          limit: pageSize,
          alertType: AlertType.Notification,
        });

        if (isUndefined(params?.after)) {
          // Fetch and show the system created activity feed alert when fetching results fro page 1
          const activityFeedAlert = await getAlertsFromName(
            'ActivityFeedAlert'
          );
          setAlerts([activityFeedAlert, ...data]);
        } else {
          setAlerts(data);
        }

        handlePagingChange(paging);
        fetchAllAlertsPermission(data);
      } catch {
        showErrorToast(
          t('server.entity-fetch-error', { entity: t('label.alert-plural') })
        );
      } finally {
        setLoadingCount((count) => count - 1);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    fetchAlertResourcePermission();
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [pageSize]);

  const handleAlertDelete = useCallback(async () => {
    try {
      setSelectedAlert(undefined);
      await getResourceLimit('eventsubscription', true, true);
      fetchAlerts();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [fetchAlerts]);

  const onPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        fetchAlerts({ [cursorType]: paging[cursorType] });
        handlePageChange(currentPage);
      }
    },
    [paging]
  );

  const columns = useMemo(
    () => [
      {
        title: t('label.name').toString(),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_: string, record: EventSubscription) => {
          return (
            record.fullyQualifiedName && (
              <Link
                data-testid="alert-name"
                to={getNotificationAlertDetailsPath(record.fullyQualifiedName)}>
                {getEntityName(record)}
              </Link>
            )
          );
        },
      },
      {
        title: t('label.trigger').toString(),
        dataIndex: ['filteringRules', 'resources'],
        width: '200px',
        key: 'FilteringRules.resources',
        render: (resources: string[]) => {
          return resources?.join(', ') || '--';
        },
      },
      {
        title: t('label.description').toString(),
        dataIndex: 'description',
        flex: true,
        key: 'description',
        render: (description: string) =>
          isEmpty(description) ? (
            <Typography.Text className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </Typography.Text>
          ) : (
            <RichTextEditorPreviewerNew markdown={description} />
          ),
      },
      {
        title: t('label.action-plural').toString(),
        dataIndex: 'fullyQualifiedName',
        width: 90,
        key: 'fullyQualifiedName',
        render: (fullyQualifiedName: string, record: EventSubscription) => {
          const alertPermission = alertPermissions?.find(
            (alert) => alert.id === record.id
          );
          if (loadingCount > 0) {
            return <Skeleton active className="p-r-lg" paragraph={false} />;
          }

          if (
            isUndefined(alertPermission) ||
            (!alertPermission.edit && !alertPermission.delete)
          ) {
            return (
              <Typography.Text className="p-l-xs">
                {NO_DATA_PLACEHOLDER}
              </Typography.Text>
            );
          }

          return (
            <div className="d-flex items-center">
              {alertPermission.edit && (
                <Tooltip placement="bottom" title={t('label.edit')}>
                  <Link to={getNotificationAlertsEditPath(fullyQualifiedName)}>
                    <Button
                      className="flex flex-center"
                      data-testid={`alert-edit-${record.name}`}
                      disabled={record.provider === ProviderType.System}
                      icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                      type="text"
                    />
                  </Link>
                </Tooltip>
              )}
              {alertPermission.delete && (
                <Tooltip placement="bottom" title={t('label.delete')}>
                  <Button
                    className="flex flex-center"
                    data-testid={`alert-delete-${record.name}`}
                    disabled={record.provider === ProviderType.System}
                    icon={<DeleteIcon height={16} />}
                    type="text"
                    onClick={() => setSelectedAlert(record)}
                  />
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [alertPermissions, loadingCount]
  );

  return (
    <PageLayoutV1 pageTitle={t('label.alert-plural')}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <div className="d-flex justify-between">
            <PageHeader data={PAGE_HEADERS.NOTIFICATION} />
            {(alertResourcePermission?.Create ||
              alertResourcePermission?.All) && (
              <LimitWrapper resource="eventsubscription">
                <Button
                  data-testid="create-notification"
                  type="primary"
                  onClick={() =>
                    navigate(
                      getSettingPath(
                        GlobalSettingsMenuCategory.NOTIFICATIONS,
                        GlobalSettingOptions.ADD_NOTIFICATION
                      )
                    )
                  }>
                  {t('label.add-entity', { entity: t('label.alert') })}
                </Button>
              </LimitWrapper>
            )}
          </div>
        </Col>
        <Col span={24}>
          <Table
            columns={columns}
            customPaginationProps={{
              currentPage,
              isLoading: loadingCount > 0,
              showPagination,
              pageSize,
              paging,
              pagingHandler: onPageChange,
              onShowSizeChange: handlePageSizeChange,
            }}
            dataSource={alerts}
            loading={Boolean(loadingCount)}
            locale={{
              emptyText: (
                <ErrorPlaceHolder
                  permission
                  className="p-y-md"
                  doc={ALERTS_DOCS}
                  heading={t('label.alert')}
                  permissionValue={t('label.create-entity', {
                    entity: t('label.alert'),
                  })}
                  type={ERROR_PLACEHOLDER_TYPE.CREATE}
                  onClick={() =>
                    navigate(
                      getSettingPath(
                        GlobalSettingsMenuCategory.NOTIFICATIONS,
                        GlobalSettingOptions.ADD_NOTIFICATION
                      )
                    )
                  }
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </Col>
        <Col span={24}>
          <DeleteWidgetModal
            afterDeleteAction={handleAlertDelete}
            allowSoftDelete={false}
            entityId={selectedAlert?.id ?? ''}
            entityName={getEntityName(selectedAlert)}
            entityType={EntityType.SUBSCRIPTION}
            visible={Boolean(selectedAlert)}
            onCancel={() => {
              setSelectedAlert(undefined);
            }}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default NotificationListPage;
