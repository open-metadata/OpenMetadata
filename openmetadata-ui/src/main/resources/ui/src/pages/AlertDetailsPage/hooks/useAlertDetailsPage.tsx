/*
 *  Copyright 2026 Collate.
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

import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AlertConfigDetails from '../../../components/Alerts/AlertDetails/AlertConfigDetails/AlertConfigDetails';
import AlertDiagnosticInfoTab from '../../../components/Alerts/AlertDetails/AlertDiagnosticInfo/AlertDiagnosticInfoTab';
import AlertRecentEventsTab from '../../../components/Alerts/AlertDetails/AlertRecentEventsTab/AlertRecentEventsTab';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlertDetailTabs } from '../../../enums/Alerts.enum';
import { EntityType } from '../../../enums/entity.enum';
import { getAlertExtraInfo } from '../../../utils/Alerts/AlertsUtil';
import searchClassBase from '../../../utils/SearchClassBase';
import {
  AlertDetailsPageProps,
  UseAlertDetailsPageReturn,
} from '../AlertDetailsPage.interface';
import { useAlertDetailsData } from './useAlertDetailsData';

export function useAlertDetailsPage(
  props: Readonly<AlertDetailsPageProps>
): UseAlertDetailsPageReturn {
  const { t } = useTranslation();
  const { alertEventCounts, alertEventCountsLoading, ...detailsData } =
    useAlertDetailsData(props);
  const { alertDetails } = detailsData;
  const { isNotificationAlert } = props;

  const alertIcon = useMemo(
    () => searchClassBase.getEntityIcon(EntityType.ALERT, 'h-9'),
    []
  );

  const tabItems = useMemo(
    () => [
      {
        label: t('label.configuration'),
        key: AlertDetailTabs.CONFIGURATION,
        children: isUndefined(alertDetails) ? (
          <ErrorPlaceHolder className="m-0" />
        ) : (
          <AlertConfigDetails
            alertDetails={alertDetails}
            isNotificationAlert={isNotificationAlert}
          />
        ),
      },
      {
        label: t('label.recent-event-plural'),
        key: AlertDetailTabs.RECENT_EVENTS,
        children: isUndefined(alertDetails) ? null : (
          <AlertRecentEventsTab alertDetails={alertDetails} />
        ),
      },
      {
        label: t('label.diagnostic-info'),
        key: AlertDetailTabs.DIAGNOSTIC_INFO,
        children: <AlertDiagnosticInfoTab />,
      },
    ],
    [alertDetails, isNotificationAlert, t]
  );

  const extraInfo = useMemo(
    () => getAlertExtraInfo(alertEventCountsLoading, alertEventCounts),
    [alertEventCounts, alertEventCountsLoading]
  );

  return { ...detailsData, alertIcon, extraInfo, tabItems };
}
