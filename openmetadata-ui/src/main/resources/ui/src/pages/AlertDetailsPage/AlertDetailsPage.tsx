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

import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/ic-delete.svg';
import AlertConfigDetails from '../../components/Alerts/AlertDetails/AlertConfigDetails/AlertConfigDetails';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ROUTES } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { EntityType } from '../../enums/entity.enum';
import {
  EventSubscription,
  ProviderType,
} from '../../generated/events/eventSubscription';
import { useFqn } from '../../hooks/useFqn';
import { getObservabilityAlertByFQN } from '../../rest/observabilityAPI';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getNotificationAlertsEditPath,
  getObservabilityAlertsEditPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import { AlertDetailsPageProps } from './AlertDetailsPage.interface';

function AlertDetailsPage({
  isNotificationAlert = false,
}: Readonly<AlertDetailsPageProps>) {
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const history = useHistory();

  const [alertDetails, setAlertDetails] = useState<EventSubscription>();
  const [loading, setLoading] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

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
    () =>
      isNotificationAlert
        ? [
            {
              name: t('label.setting-plural'),
              url: ROUTES.SETTINGS,
            },
            {
              name: t('label.notification-plural'),
              url: getSettingPath(GlobalSettingsMenuCategory.NOTIFICATIONS),
            },
            {
              name: getEntityName(alertDetails),
              url: '',
            },
          ]
        : [
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
    isNotificationAlert
      ? history.push(ROUTES.NOTIFICATION_ALERTS)
      : history.push(ROUTES.OBSERVABILITY_ALERTS);
  }, [history]);

  const handleAlertEdit = useCallback(async () => {
    history.push(
      isNotificationAlert
        ? getNotificationAlertsEditPath(fqn)
        : getObservabilityAlertsEditPath(fqn)
    );
  }, [history]);

  useEffect(() => {
    fetchAlerts();
  }, []);

  return (
    <ResizablePanels
      hideSecondPanel
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        children: loading ? (
          <Loader />
        ) : (
          <div
            className="steps-form-container"
            data-testid="alert-details-container">
            <Row
              className="add-notification-container p-x-lg p-t-md"
              gutter={[0, 16]}>
              <Col span={24}>
                <TitleBreadcrumb titleLinks={breadcrumb} />
              </Col>

              <Col span={24}>
                <Row justify="space-between">
                  <Col>
                    <Typography.Title level={5}>
                      {t('label.entity-detail-plural', {
                        entity: isNotificationAlert
                          ? t('label.notification-alert')
                          : t('label.observability-alert'),
                      })}
                    </Typography.Title>
                  </Col>
                  <Col>
                    <Space align="center" size={8}>
                      <Tooltip
                        title={t('label.edit-entity', {
                          entity: t('label.alert'),
                        })}>
                        <Button
                          className="flex flex-center"
                          data-testid="edit-button"
                          disabled={
                            alertDetails?.provider === ProviderType.System
                          }
                          icon={<EditIcon height={16} width={16} />}
                          onClick={handleAlertEdit}
                        />
                      </Tooltip>
                      <Tooltip
                        title={t('label.delete-entity', {
                          entity: t('label.alert'),
                        })}>
                        <Button
                          className="flex flex-center"
                          data-testid="delete-button"
                          disabled={
                            alertDetails?.provider === ProviderType.System
                          }
                          icon={<DeleteIcon height={16} width={16} />}
                          onClick={() => setShowDeleteModal(true)}
                        />
                      </Tooltip>
                    </Space>
                  </Col>
                </Row>
              </Col>

              <Col span={24}>
                <Space direction="vertical">
                  <Typography.Text className="font-medium">
                    {`${t('label.name')} :`}
                  </Typography.Text>
                  <Typography.Text data-testid="alert-name">
                    {getEntityName(alertDetails)}
                  </Typography.Text>
                </Space>
              </Col>
              {alertDetails?.description && (
                <Col data-testid="alert-description" span={24}>
                  <Typography.Text className="font-medium">{`${t(
                    'label.description'
                  )} :`}</Typography.Text>
                  <RichTextEditorPreviewer
                    className="p-t-xs"
                    markdown={alertDetails.description}
                  />
                </Col>
              )}
              {alertDetails && (
                <AlertConfigDetails alertDetails={alertDetails} />
              )}
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
      secondPanel={{
        children: <></>,
        minWidth: 0,
        className: 'content-resizable-panel-container',
      }}
    />
  );
}

export default AlertDetailsPage;
