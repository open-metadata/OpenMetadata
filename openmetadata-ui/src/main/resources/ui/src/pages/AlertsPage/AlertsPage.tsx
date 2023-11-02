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
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../components/common/Table/Table';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { ALERTS_DOCS } from '../../constants/docs.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import {
  EventSubscription,
  ProviderType,
} from '../../generated/events/eventSubscription';
import { usePaging } from '../../hooks/paging/usePaging';
import { getAllAlerts } from '../../rest/alertsAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AlertsPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [loading, setLoading] = useState(true);
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

  const fetchAlerts = useCallback(async (after?: string) => {
    setLoading(true);
    try {
      const { data, paging } = await getAllAlerts({ after });

      setAlerts(data.filter((d) => d.provider !== ProviderType.System));
      handlePagingChange(paging);
    } catch (error) {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.alert-plural') })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, []);

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
        fetchAlerts(cursorType + '');
        handlePageChange(currentPage);
      }
    },
    []
  );

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (name: string, record: EventSubscription) => {
          return <Link to={`alert/${record.id}`}>{name}</Link>;
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
        dataIndex: 'id',
        width: 120,
        key: 'id',
        render: (id: string, record: EventSubscription) => {
          return (
            <div className="d-flex items-center">
              <Tooltip placement="bottom" title={t('label.edit')}>
                <Link to={`edit-alert/${id}`}>
                  <Button
                    className="d-inline-flex items-center justify-center"
                    data-testid={`alert-edit-${record.name}`}
                    icon={<EditIcon width={16} />}
                    type="text"
                  />
                </Link>
              </Tooltip>
              <Tooltip placement="bottom" title={t('label.delete')}>
                <Button
                  data-testid={`alert-delete-${record.name}`}
                  disabled={record.provider === ProviderType.System}
                  icon={<SVGIcons className="w-4" icon={Icons.DELETE} />}
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

  const pageHeaderData = useMemo(
    () => ({
      header: t('label.alert-plural'),
      subHeader: t('message.alerts-description'),
    }),
    []
  );

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div className="d-flex justify-between">
            <PageHeader data={pageHeaderData} />
            <Link
              to={getSettingPath(
                GlobalSettingsMenuCategory.NOTIFICATIONS,
                GlobalSettingOptions.ADD_ALERTS
              )}>
              <Button data-testid="create-alert" type="primary">
                {t('label.create-entity', { entity: 'alert' })}
              </Button>
            </Link>
          </div>
        </Col>
        <Col span={24}>
          <Table
            bordered
            columns={columns}
            dataSource={alerts}
            loading={loading}
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
                        GlobalSettingOptions.ADD_ALERTS
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
    </>
  );
};

export default AlertsPage;
