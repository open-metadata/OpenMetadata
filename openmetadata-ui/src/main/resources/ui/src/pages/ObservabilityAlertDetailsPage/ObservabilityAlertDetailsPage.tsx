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

import {
  Button,
  Card,
  Col,
  Divider,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { isEmpty, isNil, startCase } from 'lodash';
import React, {
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/ic-delete.svg';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import Loader from '../../components/Loader/Loader';
import { ROUTES } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
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
  const history = useHistory();

  const [alertDetails, setAlertDetails] = useState<EventSubscription>();
  const [loading, setLoading] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

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

  const handleAlertDelete = useCallback(async () => {
    history.push(ROUTES.OBSERVABILITY_ALERTS);
  }, [history]);

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
          <Typography.Text className="font-medium">{heading}</Typography.Text>
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
                      <Col className="font-medium" span={24}>
                        <Typography.Text>{argument.name}</Typography.Text>
                      </Col>
                      <Col span={24}>
                        {argument.input?.map((inputItem) => (
                          <Tooltip key={inputItem} title={inputItem}>
                            <Tag className="m-b-xs w-max-full">
                              <Typography.Text ellipsis>
                                {inputItem}
                              </Typography.Text>
                            </Tag>
                          </Tooltip>
                        ))}
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
                            <Col className="font-medium" span={24}>
                              <Typography.Text>
                                {t('label.receiver-plural')}
                              </Typography.Text>
                            </Col>
                            <Col span={24}>
                              {destination.config?.receivers?.map(
                                (receiver) => (
                                  <Tooltip key={receiver} title={receiver}>
                                    <Tag className="m-b-xs w-max-full">
                                      <Typography.Text ellipsis>
                                        {receiver}
                                      </Typography.Text>
                                    </Tag>
                                  </Tooltip>
                                )
                              )}
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
                    <Space size={8}>
                      <Link to={getObservabilityAlertsEditPath(fqn)}>
                        <Button
                          className="flex flex-center"
                          data-testid="edit-button"
                          icon={<EditIcon height={16} width={16} />}
                        />
                      </Link>
                      <Button
                        className="flex flex-center"
                        data-testid="delete-button"
                        icon={<DeleteIcon height={16} width={16} />}
                        onClick={() => setShowDeleteModal(true)}
                      />
                    </Space>
                  </Col>
                </Row>
              </Col>

              <Col span={24}>
                <Space direction="vertical">
                  <Typography.Text className="font-medium">
                    {`${t('label.name')} :`}
                  </Typography.Text>
                  <Typography.Text>
                    {getEntityName(alertDetails)}
                  </Typography.Text>
                </Space>
              </Col>
              {alertDetails?.description && (
                <Col span={24}>
                  <Typography.Text className="font-medium">{`${t(
                    'label.description'
                  )} :`}</Typography.Text>
                  <RichTextEditorPreviewer
                    className="p-t-xs"
                    data-testid="description"
                    markdown={alertDetails.description}
                  />
                </Col>
              )}
              <Col span={24}>
                {getObservabilityDetailsItem({
                  details: (
                    <div className="d-flex items-center gap-2 m-l-sm">
                      {getIconForEntity(resource ?? '')}
                      <span>{startCase(resource)}</span>
                    </div>
                  ),
                  heading: t('label.trigger'),
                  subHeading: t('message.alerts-trigger-description'),
                })}
              </Col>
              {!isEmpty(filters) && !isNil(filters) && (
                <Col span={24}>
                  {getObservabilityDetailsItem({
                    details: getFilterDetails(true, filters),
                    heading: t('label.filter-plural'),
                    subHeading: t('message.alerts-filter-description'),
                  })}
                </Col>
              )}
              {!isEmpty(actions) && !isNil(actions) && (
                <Col span={24}>
                  {getObservabilityDetailsItem({
                    details: getFilterDetails(false, actions),
                    heading: t('label.action-plural'),
                    subHeading: t('message.alerts-action-description'),
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
            <DeleteWidgetModal
              afterDeleteAction={handleAlertDelete}
              allowSoftDelete={false}
              entityId={alertDetails?.id ?? ''}
              entityName={getEntityName(alertDetails)}
              entityType={EntityType.SUBSCRIPTION}
              visible={showDeleteModal}
              onCancel={() => {
                setShowDeleteModal(false);
              }}
            />
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
