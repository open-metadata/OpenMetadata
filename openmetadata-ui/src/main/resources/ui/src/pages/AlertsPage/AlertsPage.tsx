/*
 *  Copyright 2021 Collate
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
import { Button, Col, Row, Table, Tag, Tooltip, Typography } from 'antd';
import { isNil } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { getAllAlerts } from '../../axiosAPIs/alertsAPI';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { PAGE_SIZE_MEDIUM } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { EntityType } from '../../enums/entity.enum';
import { AlertAction } from '../../generated/alerts/alertAction';
import { Alerts } from '../../generated/alerts/alerts';
import { Paging } from '../../generated/type/paging';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const AlertsPage = () => {
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alerts[]>([]);
  const [alertsPaging, setAlertsPaging] = useState<Paging>({
    total: 0,
  } as Paging);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState<Alerts>();
  const history = useHistory();

  const fetchAlerts = useCallback(async (after?: string) => {
    setLoading(true);
    try {
      const { data, paging } = await getAllAlerts({ after });

      setAlerts(data);
      setAlertsPaging(paging);
      // eslint-disable-next-line no-empty
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleAlertDelete = useCallback(async () => {
    if (selectedAlert) {
      //   await deleteAlert(selectedAlert.id);

      setAlerts((alerts) =>
        alerts.filter((alert) => alert.id === selectedAlert.id)
      );
      setSelectedAlert(undefined);
    }
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
        render: (name: string, record: Alerts) => (
          <Link to={`settings/collaboration/alert/${record.id}`}>{name}</Link>
        ),
      },
      {
        title: t('label.trigger'),
        dataIndex: 'triggerConfig.type',
        width: '200px',
        key: 'triggerConfig.type',
      },
      {
        title: t('label.destination'),
        dataIndex: 'alertActions',
        width: '200px',
        key: 'alertActions',
        render: (actions: AlertAction[]) =>
          actions.map((action) => <Tag key={action.name}>{action.name}</Tag>),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        flex: true,
        key: 'description',
      },

      //   {
      //     title: t('label.status'),
      //     dataIndex: 'status',
      //     width: '200px',
      //     key: 'status',
      //   },
      {
        title: t('label.actions'),
        dataIndex: 'id',
        key: 'id',
        render: (_: string, record: Alerts) => {
          return (
            <Tooltip placement="bottom" title={t('label.delete')}>
              <Button
                data-testid={`alert-delete-${record.name}`}
                //   disabled={isDisabled}
                icon={
                  <SVGIcons
                    alt={t('label.delete')}
                    className="tw-w-4"
                    icon={Icons.DELETE}
                  />
                }
                type="text"
                onClick={() => setSelectedAlert(record)}
              />
            </Tooltip>
          );

          //   return (
          //     <SVGIcons
          //       className="cursor-pointer"
          //       height={16}
          //       icon={Icons.DELETE}
          //       width={16}
          //       onClick={handleAlertDelete(id)}
          //     />
          //   );
        },
      },
    ],
    [handleAlertDelete]
  );

  const handleCreateAlert = () => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.COLLABORATION,
        GlobalSettingOptions.ADD_ALERTS
      )
    );
  };

  return (
    <PageContainerV1>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div className="d-flex justify-between">
            <div>
              <Typography.Title level={5}>Alerts</Typography.Title>
              <Typography.Text>Alerts body</Typography.Text>
            </div>
            <Button type="primary" onClick={handleCreateAlert}>
              Create Alert
            </Button>
          </div>
        </Col>
        <Col span={24}>
          <Table
            bordered
            columns={columns}
            dataSource={alerts}
            loading={loading}
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
    </PageContainerV1>
  );
};

export default AlertsPage;
