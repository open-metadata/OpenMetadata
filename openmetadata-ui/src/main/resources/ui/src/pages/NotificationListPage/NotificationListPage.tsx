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
import { Button, Col, Row, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/ic-delete.svg';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../components/common/Table/Table';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ALERTS_DOCS } from '../../constants/docs.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../generated/events/eventSubscription';
import { Paging } from '../../generated/type/paging';
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
  const history = useHistory();
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
      } catch (error) {
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
    fetchAlerts();
  }, [pageSize]);

  const handleAlertDelete = useCallback(async () => {
    try {
      setSelectedAlert(undefined);
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
        title: t('label.name'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (name: string, record: EventSubscription) => {
          return (
            record.fullyQualifiedName && (
              <Link
                data-testid="alert-name"
                to={getNotificationAlertDetailsPath(record.fullyQualifiedName)}>
                {name}
              </Link>
            )
          );
        },
      },
      {
        title: t('label.trigger'),
        dataIndex: ['filteringRules', 'resources'],
        width: '200px',
        key: 'FilteringRules.resources',
        render: (resources: string[]) => {
          return resources?.join(', ') || '--';
        },
      },
      {
        title: t('label.description'),
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
            description
          ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'fullyQualifiedName',
        width: 120,
        key: 'fullyQualifiedName',
        render: (id: string, record: EventSubscription) => {
          return (
            <div className="d-flex items-center">
              <Tooltip placement="bottom" title={t('label.edit')}>
                <Link to={getNotificationAlertsEditPath(id)}>
                  <Button
                    className="flex flex-center"
                    data-testid={`alert-edit-${record.name}`}
                    icon={<EditIcon height={16} />}
                    type="text"
                  />
                </Link>
              </Tooltip>
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
            </div>
          );
        },
      },
    ],
    [handleAlertDelete]
  );

  return (
    <PageLayoutV1 pageTitle={t('label.alert-plural')}>
      <Row className="page-container" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <div className="d-flex justify-between">
            <PageHeader data={PAGE_HEADERS.NOTIFICATION} />
            <Link
              to={getSettingPath(
                GlobalSettingsMenuCategory.NOTIFICATIONS,
                GlobalSettingOptions.ADD_NOTIFICATION
              )}>
              <Button data-testid="create-notification" type="primary">
                {t('label.add-entity', { entity: t('label.alert') })}
              </Button>
            </Link>
          </div>
        </Col>
        <Col span={24}>
          <Table
            bordered
            columns={columns}
            dataSource={alerts}
            loading={Boolean(loadingCount)}
            locale={{
              emptyText: (
                <ErrorPlaceHolder
                  permission
                  className="p-y-md"
                  doc={ALERTS_DOCS}
                  heading={t('label.alert')}
                  type={ERROR_PLACEHOLDER_TYPE.CREATE}
                  onClick={() =>
                    history.push(
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
          {showPagination && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={onPageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          )}

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
