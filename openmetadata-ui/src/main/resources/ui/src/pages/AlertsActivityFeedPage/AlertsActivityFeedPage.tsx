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

import { Card } from 'antd';
import { AlertDetailsComponent } from 'components/Alerts/AlertsDetails/AlertDetails.component';
import Loader from 'components/Loader/Loader';
import { noop, trim } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAlertActionForAlerts, getAlertsFromName } from 'rest/alertsAPI';
import { AlertAction } from '../../generated/alerts/alertAction';
import { AlertFilterRule, Alerts } from '../../generated/alerts/alerts';
import { getEntityName } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AlertsActivityFeedPage = () => {
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<Alerts>();
  const [alertActions, setAlertActions] = useState<AlertAction[]>();
  const { t } = useTranslation();

  const fetchActivityFeedAlert = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAlertsFromName('ActivityFeedAlert');

      const requestFilteringRules =
        response.filteringRules?.map((curr) => {
          const [fullyQualifiedName, filterRule] = curr.condition.split('(');

          return {
            ...curr,
            fullyQualifiedName,
            condition: filterRule
              .replaceAll("'", '')
              .replace(new RegExp(`\\)`), '')
              .split(',')
              .map(trim),
          } as unknown as AlertFilterRule;
        }) ?? [];

      const alertActions = await getAlertActionForAlerts(response.id);
      setAlertActions(alertActions);
      setAlert({ ...response, filteringRules: requestFilteringRules });
    } catch (error) {
      showErrorToast(
        t('server.entity-fetch-error', {
          entity: t('label.activity-feed-plural'),
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivityFeedAlert();
  }, []);

  const pageHeaderData = useMemo(
    () => ({
      header: getEntityName(alert),
      subHeader: alert?.description || '',
    }),
    [alert]
  );

  if (loading) {
    return <Card loading={loading} />;
  }

  return alert && alertActions ? (
    <AlertDetailsComponent
      alertActions={alertActions}
      alerts={alert}
      allowDelete={false}
      pageHeaderData={pageHeaderData}
      onDelete={noop}
    />
  ) : (
    <Loader />
  );
};

export default AlertsActivityFeedPage;
