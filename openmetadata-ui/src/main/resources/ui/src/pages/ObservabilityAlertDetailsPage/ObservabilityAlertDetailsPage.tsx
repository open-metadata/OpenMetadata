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

import { Button, Card, Col, Divider, Row, Space, Typography } from 'antd';
import { isEmpty, isNil, startCase, toString } from 'lodash';
import React, {
  Fragment,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import Loader from '../../components/Loader/Loader';
import { ROUTES } from '../../constants/constants';
import {
  ArgumentsInput,
  EventSubscription,
} from '../../generated/events/eventSubscription';
import { useFqn } from '../../hooks/useFqn';
import { getObservabilityAlertByFQN } from '../../rest/observabilityAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getIconForEntity } from '../../utils/ObservabilityUtils';
import { getObservabilityAlertsEditPath } from '../../utils/RouterUtils';
import '../AddObservabilityPage/add-observability-page.less';

function ObservabilityAlertDetailsPage() {
  const { t } = useTranslation();
  const { fqn } = useFqn();

  const [alertDetails, setAlertDetails] = useState<EventSubscription>();
  const [loading, setLoading] = useState<boolean>(true);

  const { resource, filters, actions, destinations } = useMemo(
    () => ({
      resource: alertDetails?.filteringRules?.resources[0],
      filters: alertDetails?.input?.filters,
      actions: alertDetails?.input?.actions,
      destinations: alertDetails?.destinations,
    }),
    [alertDetails]
  );

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const observabilityAlert = await getObservabilityAlertByFQN(fqn);

      setAlertDetails(observabilityAlert);
    } catch (error) {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.observability'),
        url: '',
      },
      {
        name: t('label.alert-plural'),
        url: ROUTES.OBSERVABILITY_ALERTS,
      },
      {
        name: getEntityName(alertDetails),
        url: '',
      },
    ],
    [alertDetails]
  );

  const getObservabilityDetailsItem = ({
    heading,
    subHeading,
    details,
  }: {
    heading: ReactNode;
    subHeading: ReactNode;
    details: ReactNode;
  }) => (
    <Card className="alert-form-item-container">
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Typography.Text>{heading}</Typography.Text>
        </Col>
        <Col span={24}>
          <Typography.Text className="text-xs text-grey-muted">
            {subHeading}
          </Typography.Text>
        </Col>
        <Col className="bg-white p-y-xs p-x-sm border rounded-4" span={24}>
          {details}
        </Col>
      </Row>
    </Card>
  );

  const getFilterDetails = (isFilter: boolean, filters?: ArgumentsInput[]) => (
    <div className="p-md">
      {filters?.map((filterDetails, index) => (
        <Fragment key={filterDetails.name}>
          <Row gutter={[0, 8]}>
            <Col className="font-medium" span={3}>
              {t('label.effect')}
            </Col>
            <Col span={1}>:</Col>
            <Col span={20}>{startCase(filterDetails.effect)}</Col>
            <Col className="font-medium" span={3}>
              {t('label.entity-name', {
                entity: isFilter ? t('label.filter') : t('label.action'),
              })}
            </Col>
            <Col span={1}>:</Col>
            <Col span={20}>{startCase(filterDetails.name)}</Col>
            {!isEmpty(filterDetails.arguments) && (
              <>
                <Col className="font-medium" span={3}>
                  {t('label.argument-plural')}
                </Col>
                <Col span={1}>:</Col>
                <Col className="border rounded-4 p-sm" span={20}>
                  {filterDetails.arguments?.map((argument) => (
                    <Row gutter={[0, 8]} key={argument.name}>
                      <Col className="font-medium" span={5}>
                        <Typography.Text>{argument.name}</Typography.Text>
                      </Col>
                      <Col span={1}>:</Col>
                      <Col span={18}>
                        <Typography.Text>
                          {toString(argument.input).replaceAll(',', ', ')}
                        </Typography.Text>
                      </Col>
                    </Row>
                  ))}
                </Col>
              </>
            )}
          </Row>
          {index < filters.length - 1 && <Divider className="m-y-sm" />}
        </Fragment>
      ))}
    </div>
  );

  const destinationDetails = useMemo(
    () => (
      <div className="p-md">
        {destinations?.map((destination, index) => (
          <Fragment key={`${destination.category}-${destination.type}`}>
            <Row gutter={[0, 8]}>
              <Col className="font-medium" span={3}>
                {t('label.category')}
              </Col>
              <Col span={1}>:</Col>
              <Col span={20}>{startCase(destination.category)}</Col>
              <Col className="font-medium" span={3}>
                {t('label.type')}
              </Col>
              <Col span={1}>:</Col>
              <Col span={20}>{startCase(destination.type)}</Col>
              {!isEmpty(destination.config?.receivers) &&
                !isNil(destination.config?.receivers) && (
                  <>
                    <Col className="font-medium" span={3}>
                      {t('label.config')}
                    </Col>
                    <Col span={1}>:</Col>
                    <Col className="border rounded-4 p-sm" span={20}>
                      <Row gutter={[0, 8]}>
                        {destination.config?.receivers && (
                          <>
                            <Col className="font-medium" span={5}>
                              <Typography.Text>
                                {t('label.receiver-plural')}
                              </Typography.Text>
                            </Col>
                            <Col span={1}>:</Col>
                            <Col span={18}>
                              <Typography.Text>
                                {toString(
                                  destination.config?.receivers
                                ).replaceAll(',', ', ')}
                              </Typography.Text>
                            </Col>
                          </>
                        )}
                      </Row>
                    </Col>
                  </>
                )}
            </Row>
            {index < destinations.length - 1 && <Divider className="m-y-sm" />}
          </Fragment>
        ))}
      </div>
    ),
    [destinations]
  );

  useEffect(() => {
    fetchAlerts();
  }, []);

  return (
    <ResizablePanels
      hideSecondPanel
      firstPanel={{
        children: loading ? (
          <Loader />
        ) : (
          <div className="alert-page-container">
            <Row
              className="add-notification-container p-x-lg p-t-md"
              gutter={[16, 16]}>
              <Col span={24}>
                <TitleBreadcrumb titleLinks={breadcrumb} />
              </Col>

              <Col span={24}>
                <Row justify="space-between">
                  <Col>
                    <Space direction="vertical">
                      <Typography.Title level={5}>
                        {t('label.create-entity', {
                          entity: t('label.observability'),
                        })}
                      </Typography.Title>
                      <Typography.Text>
                        {t('message.alerts-description')}
                      </Typography.Text>
                    </Space>
                  </Col>
                  <Col>
                    <Link to={getObservabilityAlertsEditPath(fqn)}>
                      <Button data-testid="edit-button" type="primary">
                        {t('label.edit')}
                      </Button>
                    </Link>
                  </Col>
                </Row>
              </Col>

              <Col span={24}>
                <Space direction="vertical">
                  <Typography.Text className="font-bold">
                    {`${t('label.name')} :`}
                  </Typography.Text>
                  <Typography.Text>
                    {getEntityName(alertDetails)}
                  </Typography.Text>
                </Space>
              </Col>
              {alertDetails?.description && (
                <Col span={24}>
                  <Typography.Text className="font-bold">{`${t(
                    'label.description'
                  )} :`}</Typography.Text>
                  <RichTextEditorPreviewer
                    data-testid="description"
                    markdown={alertDetails.description}
                  />
                </Col>
              )}
              <Col span={24}>
                {getObservabilityDetailsItem({
                  details: (
                    <div className="d-flex items-center gap-2">
                      {getIconForEntity(resource ?? '')}
                      <span>{startCase(resource)}</span>
                    </div>
                  ),
                  heading: t('label.trigger'),
                  subHeading: t('message.alerts-trigger-description'),
                })}
              </Col>
              <Col span={24}>
                {getObservabilityDetailsItem({
                  details: getFilterDetails(true, filters),
                  heading: t('label.filter-plural'),
                  subHeading: t('message.alerts-filter-description'),
                })}
              </Col>
              {actions && (
                <Col span={24}>
                  {getObservabilityDetailsItem({
                    details: getFilterDetails(false, actions),
                    heading: t('label.action-plural'),
                    subHeading: t('message.alerts-filter-description'),
                  })}
                </Col>
              )}
              <Col span={24}>
                {getObservabilityDetailsItem({
                  details: destinationDetails,
                  heading: t('label.destination'),
                  subHeading: t('message.alerts-destination-description'),
                })}
              </Col>
            </Row>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.entity-detail-plural', { entity: t('label.alert') })}
      secondPanel={{ children: <></>, minWidth: 0 }}
    />
  );
}

export default ObservabilityAlertDetailsPage;
