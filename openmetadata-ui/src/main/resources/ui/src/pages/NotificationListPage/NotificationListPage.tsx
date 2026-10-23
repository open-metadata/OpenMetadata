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
import {
  Box,
  Button,
  ButtonUtility,
  Grid,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import DeleteModal from '../../components/common/DeleteModal/DeleteModal';
import FeaturesPlaceholder from '../../components/common/EmptyPlaceholder/FeaturesPlaceholder';
import PermissionPlaceholder from '../../components/common/EmptyPlaceholder/PermissionPlaceholder';
import SomethingWentWrongPlaceholder from '../../components/common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../components/common/Table/TableV2';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ALERT_EMPTY_STATE_FEATURES } from '../../constants/Alerts.constants';
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { EntityType } from '../../enums/entity.enum';
import { ResourceEntity } from '../../enums/permissions.enum';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../generated/events/eventSubscription';
import { Paging } from '../../generated/type/paging';
import LimitWrapper from '../../hoc/LimitWrapper';
import { usePaging } from '../../hooks/paging/usePaging';
import { getAlertsFromName, getAllAlerts } from '../../rest/alertsAPI';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { hardDeleteEntity } from '../../utils/DeleteWidget/DeleteWidgetUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import {
  getNotificationAlertDetailsPath,
  getNotificationAlertsEditPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import { descriptionTableObject } from '../../utils/TableColumn.util';
import { showErrorToast } from '../../utils/ToastUtils';

const NotificationListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadingCount, setLoadingCount] = useState(0);
  const [alerts, setAlerts] = useState<EventSubscription[]>([]);
  const [alertsError, setAlertsError] = useState<AxiosError>();
  const [selectedAlert, setSelectedAlert] = useState<EventSubscription>();
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    pageSize,
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
    paging,
    pagingCursor,
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
  const canCreateAlert = alertResourcePermission
    ? getDerivedPermissionFlags(alertResourcePermission).canCreate
    : false;

  const fetchAlertPermissionByFqn = async (alertDetails: EventSubscription) => {
    const permission = await getEntityPermissionByFqn(
      ResourceEntity.EVENT_SUBSCRIPTION,
      alertDetails.fullyQualifiedName ?? ''
    );

    // Pure rename — old raw read never referenced `deleted` here (ungated).
    const editPermission = getDerivedPermissionFlags(permission).canEditAll;
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
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.NOTIFICATIONS,
        t('label.alert-plural')
      ),
    []
  );

  const fetchAlerts = useCallback(
    async (params?: Partial<Paging>) => {
      setLoadingCount((count) => count + 1);
      setAlertsError(undefined);
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
      } catch (error) {
        setAlertsError(error as AxiosError);
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

  // Re-requests the page the user is on, so a retry after a failed page 2+
  // does not show page 1's alerts under the current page number.
  const fetchCurrentPage = useCallback(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchAlerts({ [cursorType]: cursorValue });
    } else {
      fetchAlerts();
    }
  }, [fetchAlerts, pagingCursor]);

  useEffect(() => {
    fetchCurrentPage();
  }, [pageSize, pagingCursor]);

  const handleAlertDelete = useCallback(async () => {
    try {
      setSelectedAlert(undefined);
      await getResourceLimit('eventsubscription', true, true);
      fetchAlerts();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [fetchAlerts]);

  const handleAlertHardDelete = useCallback(async () => {
    setIsDeleting(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(selectedAlert),
      selectedAlert?.id ?? '',
      EntityType.SUBSCRIPTION
    );
    if (isSuccess) {
      await handleAlertDelete();
    } else {
      setSelectedAlert(undefined);
    }
    setIsDeleting(false);
  }, [selectedAlert, handleAlertDelete]);

  const onPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        fetchAlerts({ [cursorType]: paging[cursorType] });
        handlePageChange(
          currentPage,
          {
            cursorType,
            cursorValue: paging[cursorType],
          },
          pageSize
        );
      }
    },
    [paging]
  );

  const handleAddAlert = useCallback(
    () =>
      navigate(
        getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.ADD_NOTIFICATION
        )
      ),
    [navigate]
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
                className="tw:block tw:max-w-48 tw:truncate"
                data-testid="alert-name"
                title={getEntityName(record)}
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
      ...descriptionTableObject<EventSubscription>({
        render: (text: string) => (
          <RichTextEditorPreviewerNew clampByLines markdown={text} />
        ),
      }),
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
            return (
              <div className="p-r-lg">
                <Skeleton height={16} />
              </div>
            );
          }

          if (
            isUndefined(alertPermission) ||
            (!alertPermission.edit && !alertPermission.delete)
          ) {
            return (
              <Typography className="p-l-xs tw:text-primary">
                {NO_DATA_PLACEHOLDER}
              </Typography>
            );
          }

          return (
            <div className="d-flex items-center">
              {alertPermission.edit && (
                <ButtonUtility
                  color="tertiary"
                  data-testid={`alert-edit-${record.name}`}
                  href={getNotificationAlertsEditPath(fullyQualifiedName)}
                  icon={Edit01}
                  isDisabled={record.provider === ProviderType.System}
                  size="lg"
                  tooltip={t('label.edit')}
                  tooltipPlacement="bottom"
                />
              )}
              {alertPermission.delete && (
                <ButtonUtility
                  color="tertiary"
                  data-testid={`alert-delete-${record.name}`}
                  icon={Trash01}
                  isDisabled={record.provider === ProviderType.System}
                  size="lg"
                  tooltip={t('label.delete')}
                  tooltipPlacement="bottom"
                  onClick={() => setSelectedAlert(record)}
                />
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
      <Grid
        className="layout-row layout-grid"
        style={{ ...getLayoutGutter(0, 16) }}>
        <Grid.Item className="layout-column" span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <div className="d-flex justify-between">
            <PageHeader
              data={{
                header: t(PAGE_HEADERS.NOTIFICATION.header),
                subHeader: t(PAGE_HEADERS.NOTIFICATION.subHeader),
              }}
              learningPageId={LEARNING_PAGE_IDS.ALERTS}
              title={t('label.alert')}
            />
            {(alertResourcePermission?.Create ||
              alertResourcePermission?.All) && (
              <LimitWrapper resource="eventsubscription">
                <Button
                  color="primary"
                  data-testid="create-notification"
                  onClick={handleAddAlert}>
                  {t('label.add-entity', { entity: t('label.alert') })}
                </Button>
              </LimitWrapper>
            )}
          </div>
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
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
            dataSource={alertsError ? [] : alerts}
            loading={Boolean(loadingCount)}
            locale={{
              emptyText: alertsError ? (
                <Box className="tw:relative tw:min-h-[calc(100vh_-_16rem)] tw:w-full">
                  {alertsError.response?.status === ClientErrors.FORBIDDEN ? (
                    <PermissionPlaceholder
                      permissionValue={t('label.view-entity', {
                        entity: t('label.alert-plural'),
                      })}
                    />
                  ) : (
                    <SomethingWentWrongPlaceholder
                      onReload={fetchCurrentPage}
                    />
                  )}
                </Box>
              ) : (
                <Box className="tw:relative tw:min-h-[calc(100vh_-_16rem)] tw:w-full">
                  <FeaturesPlaceholder
                    actions={
                      canCreateAlert
                        ? [
                            {
                              key: 'new-alert',
                              label: t('label.new-entity', {
                                entity: t('label.alert'),
                              }),
                              color: 'primary' as const,
                              iconLeading: Plus,
                              onPress: handleAddAlert,
                            },
                          ]
                        : undefined
                    }
                    description={t(
                      'message.observability-alert-empty-description'
                    )}
                    features={ALERT_EMPTY_STATE_FEATURES.map(
                      ({
                        key,
                        Icon,
                        iconClassName,
                        titleKey,
                        descriptionKey,
                      }) => ({
                        key,
                        icon: <Icon className={iconClassName} />,
                        title: t(titleKey),
                        description: t(descriptionKey),
                      })
                    )}
                    title={t('message.observability-alert-empty-heading')}
                  />
                </Box>
              ),
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <DeleteModal
            entityTitle={getEntityName(selectedAlert)}
            isDeleting={isDeleting}
            message={t('message.permanently-delete-common-message', {
              entity: getEntityName(selectedAlert)?.toLowerCase?.() ?? '',
            })}
            open={Boolean(selectedAlert)}
            onCancel={() => {
              setSelectedAlert(undefined);
            }}
            onDelete={handleAlertHardDelete}
          />
        </Grid.Item>
      </Grid>
    </PageLayoutV1>
  );
};

export default NotificationListPage;
