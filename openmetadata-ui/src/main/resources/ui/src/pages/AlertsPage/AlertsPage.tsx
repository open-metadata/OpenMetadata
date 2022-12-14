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
import { Button, Col, Row, Table, Typography } from 'antd';
import { isNil } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteAlert, getAllAlerts } from '../../axiosAPIs/alertsAPI';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { PAGE_SIZE_MEDIUM } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
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

  const handleAlertDelete = useCallback(
    (id: string) => async () => {
      if (id) {
        await deleteAlert(id);

        fetchAlerts();
      }
    },
    []
  );

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
        dataIndex: 'displayName',
        width: '200px',
        key: 'displayName',
      },
      {
        title: t('label.last-fail'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
      },
      {
        title: t('label.last-alert-published-at'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
      },
      {
        title: t('label.description'),
        dataIndex: 'description',

        flex: true,
        key: 'description',
      },

      {
        title: t('label.status'),
        dataIndex: 'status',
        width: '200px',
        key: 'status',
      },
      {
        title: '',
        dataIndex: 'id',
        key: 'id',
        render: (id: string) => {
          return (
            <>
              <SVGIcons
                icon={Icons.DELETE_GRADIANT}
                onClick={handleAlertDelete(id)}
              />
            </>
          );
        },
      },
    ],
    [handleAlertDelete]
  );

  return (
    <PageContainerV1>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div className="d-flex justify-between">
            <div>
              <Typography.Title level={5}>Alerts</Typography.Title>
              <Typography.Text>Alerts body</Typography.Text>
            </div>
            <Button
              href={getSettingPath(
                GlobalSettingsMenuCategory.COLLABORATION,
                GlobalSettingOptions.ADD_ALERTS
              )}
              type="primary">
              Create Alert
            </Button>
          </div>
        </Col>
        <Col span={24}>
          <Table
            bordered
            columns={columns}
            dataSource={alerts}
            expandable={{
              expandedRowRender: (record) => (
                <Table
                  columns={columns}
                  dataSource={record.alertActions}
                  rowKey="id"
                  size="middle"
                />
              ),
              rowExpandable: (record) =>
                record.alertActions && record.alertActions.length > 0,
            }}
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
        </Col>
      </Row>
    </PageContainerV1>
  );
};

export default AlertsPage;
