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
import { Button, Col, Row, Table, Tooltip, Typography } from 'antd';
import DeleteWidgetModal from 'components/common/DeleteWidget/DeleteWidgetModal';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import PageHeader from 'components/header/PageHeader.component';
import Loader from 'components/Loader/Loader';
import { isEmpty, isNil } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getAllAlerts } from 'rest/alertsAPI';
import { getEntityName } from 'utils/EntityUtils';
import { PAGE_SIZE_MEDIUM } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { EntityType } from '../../enums/entity.enum';
import { Alerts, ProviderType } from '../../generated/alerts/alerts';
import { Paging } from '../../generated/type/paging';
import { getDisplayNameForTriggerType } from '../../utils/Alerts/AlertsUtil';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AlertsPage = () => {
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alerts[]>([]);
  const [alertsPaging, setAlertsPaging] = useState<Paging>({
    total: 0,
  } as Paging);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState<Alerts>();

  const fetchAlerts = useCallback(async (after?: string) => {
    setLoading(true);
    try {
      const { data, paging } = await getAllAlerts({ after });

      setAlerts(data.filter((d) => d.provider !== ProviderType.System));
      setAlertsPaging(paging);
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
    fetchAlerts();
  }, []);

  const onPageChange = useCallback((after: string | number, page?: number) => {
    if (after) {
      fetchAlerts(after + '');
      page && setCurrentPage(page);
    }
  }, []);

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_: string, record: Alerts) => {
          return <Link to={`alert/${record.id}`}>{getEntityName(record)}</Link>;
        },
      },
      {
        title: t('label.trigger'),
        dataIndex: ['triggerConfig', 'type'],
        width: '200px',
        key: 'triggerConfig.type',
        render: getDisplayNameForTriggerType,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        flex: true,
        key: 'description',
        render: (text: string) =>
          !isEmpty(text) ? <Typography.Text>{text}</Typography.Text> : '--',
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'id',
        width: 120,
        key: 'id',
        render: (id: string, record: Alerts) => {
          return (
            <>
              <Tooltip placement="bottom" title={t('label.edit')}>
                <Link to={`edit-alert/${id}`}>
                  <Button
                    data-testid={`alert-edit-${record.name}`}
                    icon={<SVGIcons className="w-4" icon={Icons.EDIT} />}
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
            </>
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
            loading={{ spinning: loading, indicator: <Loader /> }}
            pagination={false}
            rowKey="id"
            size="middle"
          />
        </Col>
        <Col span={24}>
          {Boolean(
            !isNil(alertsPaging.after) || !isNil(alertsPaging.before)
          ) && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={PAGE_SIZE_MEDIUM}
              paging={alertsPaging}
              pagingHandler={onPageChange}
              totalCount={alertsPaging.total}
            />
          )}

          <DeleteWidgetModal
            afterDeleteAction={handleAlertDelete}
            allowSoftDelete={false}
            entityId={selectedAlert?.id || ''}
            entityName={selectedAlert?.name || ''}
            entityType={EntityType.ALERT}
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
