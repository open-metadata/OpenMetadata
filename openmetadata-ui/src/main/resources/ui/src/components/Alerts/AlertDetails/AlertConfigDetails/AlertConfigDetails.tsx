/*
 *  Copyright 2024 Collate.
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

import { Col, Divider, Form, Row } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterResourceDescriptor } from '../../../../generated/events/filterResourceDescriptor';
import { ModifiedCreateEventSubscription } from '../../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { getResourceFunctions as getNotificationResourceFunctions } from '../../../../rest/alertsAPI';
import { getResourceFunctions } from '../../../../rest/observabilityAPI';
import { getModifiedAlertDataForForm } from '../../../../utils/Alerts/AlertsUtil';
import Fqn from '../../../../utils/Fqn';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import AlertFormSourceItem from '../../AlertFormSourceItem/AlertFormSourceItem';
import DestinationFormItem from '../../DestinationFormItem/DestinationFormItem.component';
import ObservabilityFormFiltersItem from '../../ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import ObservabilityFormTriggerItem from '../../ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';
import './alert-config-details.less';
import { AlertConfigDetailsProps } from './AlertConfigDetails.interface';

function AlertConfigDetails({
  alertDetails,
  isNotificationAlert,
}: AlertConfigDetailsProps) {
  const { t } = useTranslation();
  const [form] = useForm<ModifiedCreateEventSubscription>();
  const modifiedAlertData = getModifiedAlertDataForForm(alertDetails);
  const [fetching, setFetching] = useState<number>(0);
  const [filterResources, setFilterResources] = useState<
    FilterResourceDescriptor[]
  >([]);

  const { supportedFilters, supportedTriggers } = useMemo(
    () => ({
      supportedFilters: filterResources.find(
        (resource) =>
          resource.name === alertDetails.filteringRules?.resources[0]
      )?.supportedFilters,
      supportedTriggers: filterResources.find(
        (resource) =>
          resource.name === alertDetails.filteringRules?.resources[0]
      )?.supportedActions,
    }),
    [filterResources, alertDetails]
  );

  const fetchFunctions = useCallback(async () => {
    try {
      setFetching((prev) => prev + 1);
      const filterResources = await (isNotificationAlert
        ? getNotificationResourceFunctions()
        : getResourceFunctions());

      setFilterResources(filterResources.data);
    } catch (error) {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.config') })
      );
    } finally {
      setFetching((prev) => prev - 1);
    }
  }, [isNotificationAlert]);

  useEffect(() => {
    fetchFunctions();
  }, [Fqn]);

  if (fetching) {
    return <Loader />;
  }

  return (
    <Form<ModifiedCreateEventSubscription>
      disabled
      className="alert-config-details"
      form={form}
      initialValues={{
        ...modifiedAlertData,
        resources: modifiedAlertData?.filteringRules?.resources,
      }}>
      <Row justify="center">
        <Col span={24}>
          <AlertFormSourceItem />
        </Col>
        {!isEmpty(modifiedAlertData.input?.filters) && (
          <>
            <Col>
              <Divider dashed type="vertical" />
            </Col>
            <Col span={24}>
              <ObservabilityFormFiltersItem
                isViewMode
                supportedFilters={supportedFilters}
              />
            </Col>
          </>
        )}
        {!isEmpty(modifiedAlertData.input?.actions) && (
          <>
            <Col>
              <Divider dashed type="vertical" />
            </Col>
            <Col span={24}>
              <ObservabilityFormTriggerItem
                isViewMode
                supportedTriggers={supportedTriggers}
              />
            </Col>
          </>
        )}
        <Col>
          <Divider dashed type="vertical" />
        </Col>
        <Col span={24}>
          <DestinationFormItem isViewMode />
        </Col>
      </Row>
    </Form>
  );
}

export default AlertConfigDetails;
