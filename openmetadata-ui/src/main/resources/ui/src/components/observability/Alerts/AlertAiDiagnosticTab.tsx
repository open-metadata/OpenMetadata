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

import { Card, Skeleton, Tooltip } from '@openmetadata/ui-core-components';
import { InfoCircle } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { TFunction } from 'i18next';
import { isUndefined } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EventSubscriptionDiagnosticInfo } from '../../../generated/events/api/eventSubscriptionDiagnosticInfo';
import { getDiagnosticInfo } from '../../../rest/observabilityAPI';
import { getDiagnosticItems } from '../../../utils/Alerts/AlertsUtilPure';
import { showErrorToast } from '../../../utils/ToastUtils';

const formatDiagnosticValue = (value: unknown, t: TFunction) => {
  if (typeof value === 'boolean') {
    return t(value ? 'label.yes' : 'label.no');
  }

  return isUndefined(value) ? NO_DATA_PLACEHOLDER : String(value);
};

interface AlertAiDiagnosticTabProps {
  fqn: string;
}

/** Offsets and processed-event counts of an alert's event subscription. */
const AlertAiDiagnosticTab = ({ fqn }: AlertAiDiagnosticTabProps) => {
  const { t } = useTranslation();
  const [diagnosticData, setDiagnosticData] =
    useState<EventSubscriptionDiagnosticInfo>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDiagnosticInfo(fqn)
      .then(setDiagnosticData)
      .catch((error: AxiosError) => showErrorToast(error))
      .finally(() => setLoading(false));
  }, [fqn]);

  const diagnosticItems = useMemo(
    () => getDiagnosticItems(diagnosticData),
    [diagnosticData]
  );

  return (
    <Card className="tw:p-6" data-testid="alert-diagnostic-info">
      <dl className="tw:m-0 tw:grid tw:grid-cols-1 tw:gap-x-8 tw:gap-y-4 tw:md:grid-cols-2">
        {diagnosticItems.map((item) => (
          <div
            className="tw:grid tw:grid-cols-2 tw:items-center"
            key={item.key}>
            <dt className="tw:flex tw:items-center tw:gap-1 tw:text-sm tw:text-tertiary">
              {`${item.key}:`}
              <Tooltip title={item.description}>
                <span
                  aria-label={item.description}
                  className="tw:inline-flex"
                  role="img">
                  <InfoCircle className="tw:size-3.5 tw:text-fg-quaternary" />
                </span>
              </Tooltip>
            </dt>
            <dd
              className="tw:m-0 tw:text-sm tw:font-medium tw:text-primary"
              data-testid={`diagnostic-value-${item.key}`}>
              {loading ? (
                <Skeleton width={64} />
              ) : (
                formatDiagnosticValue(item.value, t)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
};

export default AlertAiDiagnosticTab;
