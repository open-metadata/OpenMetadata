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

import { Table, Typography } from 'antd';
import { startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAlertActionForAlerts } from '../../axiosAPIs/alertsAPI';
import Loader from '../../components/Loader/Loader';
import { AlertAction } from '../../generated/alerts/alertAction';
import { Alerts } from '../../generated/alerts/alerts';
import { showErrorToast } from '../../utils/ToastUtils';

export const AlertsExpanded = ({ alert }: { alert: Alerts }) => {
  const [alertActions, setAlertActions] = useState<AlertAction[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const fetchAlertActions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAlertActionForAlerts(alert.id);
      setAlertActions(response);
    } catch (error) {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.alert-actions') })
      );
    } finally {
      setLoading(false);
    }
  }, [alert.id]);

  useEffect(() => {
    if (alert.id) {
      fetchAlertActions();
    }
  }, [alert.id]);

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'displayName',
        width: '200px',
        key: 'displayName',
      },
      {
        title: t('label.destination'),
        dataIndex: 'alertActionType',
        width: '200px',
        key: 'alertActionType',
        render: startCase,
      },
      {
        title: t('label.batch-size'),
        dataIndex: 'batchSize',
        width: '200px',
        key: 'batchSize',
      },
      {
        title: t('label.timeout'),
        dataIndex: 'timeout',
        width: '200px',
        key: 'timeout',
      },
      {
        title: t('label.endpoint'),
        dataIndex: ['alertActionConfig', 'endpoint'],
        width: '200px',
        key: 'endpoint',
      },
    ],
    []
  );

  return (
    <div className="p-x-sm">
      <Typography.Title level={5}>{t('label.alert-actions')}</Typography.Title>
      <Table
        bordered={false}
        columns={columns}
        dataSource={alertActions}
        loading={{ spinning: loading, indicator: <Loader size="small" /> }}
        pagination={false}
        rowKey="name"
        size="small"
      />
    </div>
  );
};
