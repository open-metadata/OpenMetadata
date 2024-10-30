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
  Col,
  Row,
  Skeleton,
  Space,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/ic-delete.svg';
import AlertConfigDetails from '../../components/Alerts/AlertDetails/AlertConfigDetails/AlertConfigDetails';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ExtraInfoLabel } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import EntityHeaderTitle from '../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { ROUTES } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { AlertDetailTabs } from '../../enums/Alerts.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import {
  EntityReference,
  EventSubscription,
  ProviderType,
} from '../../generated/events/eventSubscription';
import { useFqn } from '../../hooks/useFqn';
import { updateNotificationAlert } from '../../rest/alertsAPI';
import {
  getObservabilityAlertByFQN,
  updateObservabilityAlert,
} from '../../rest/observabilityAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getNotificationAlertDetailsPath,
  getNotificationAlertsEditPath,
  getObservabilityAlertDetailsPath,
  getObservabilityAlertsEditPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import searchClassBase from '../../utils/SearchClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import './alert-details-page.less';
import { AlertDetailsPageProps } from './AlertDetailsPage.interface';

function AlertDetailsPage({
  isNotificationAlert = false,
}: Readonly<AlertDetailsPageProps>) {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { tab = AlertDetailTabs.CONFIGURATION } =
    useParams<{ tab: AlertDetailTabs }>();
  const { fqn } = useFqn();
  const history = useHistory();

  const [alertDetails, setAlertDetails] = useState<EventSubscription>();
  const [loadingCount, setLoadingCount] = useState(1);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [alertPermission, setAlertPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const {
    viewPermission,
    editOwnersPermission,
    editPermission,
    deletePermission,
  } = useMemo(
    () => ({
      viewPermission: alertPermission.ViewAll || alertPermission.ViewBasic,
      editPermission: alertPermission.EditAll,
      editOwnersPermission:
        alertPermission.EditAll || alertPermission.EditOwners,
      deletePermission: alertPermission.Delete,
    }),
    [alertPermission]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      if (fqn) {
        const searchIndexPermission = await getEntityPermissionByFqn(
          ResourceEntity.EVENT_SUBSCRIPTION,
          fqn
        );

        setAlertPermission(searchIndexPermission);
      }
    } finally {
      setLoadingCount((count) => count - 1);
    }
  }, [fqn, getEntityPermissionByFqn]);

  const alertIcon = useMemo(
    () => searchClassBase.getEntityIcon(EntityType.ALERT, 'h-9'),
    []
  );

  const fetchAlertDetails = async () => {
    try {
      setLoadingCount((count) => count + 1);
      const observabilityAlert = await getObservabilityAlertByFQN(fqn, {
        fields: 'owners',
      });

      setAlertDetails(observabilityAlert);
    } catch (error) {
      // Error handling
    } finally {
      setLoadingCount((count) => count - 1);
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

  const onOwnerUpdate = useCallback(
    async (owners?: EntityReference[]) => {
      try {
        setOwnerLoading(true);
        const jsonPatch = compare(omitBy(alertDetails, isUndefined), {
          ...alertDetails,
          owners,
        });

        const updatedAlert = await (isNotificationAlert
          ? updateNotificationAlert(alertDetails?.id ?? '', jsonPatch)
          : updateObservabilityAlert(alertDetails?.id ?? '', jsonPatch));

        setAlertDetails(updatedAlert);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setOwnerLoading(false);
      }
    },
    [fqn, history, alertDetails]
  );

  const tabItems = useMemo(
    () => [
      {
        label: t('label.configuration'),
        key: AlertDetailTabs.CONFIGURATION,
        children: isUndefined(alertDetails) ? (
          <ErrorPlaceHolder className="m-0" />
        ) : (
          <AlertConfigDetails alertDetails={alertDetails} />
        ),
      },
      {
        label: t('label.recent-event-plural'),
        key: AlertDetailTabs.RECENT_EVENTS,
        children: 'Recent Events',
      },
    ],
    [alertDetails]
  );

  const handleTabChange = useCallback(
    (activeKey: string) => {
      history.replace(
        isNotificationAlert
          ? getNotificationAlertDetailsPath(fqn, activeKey)
          : getObservabilityAlertDetailsPath(fqn, activeKey)
      );
    },
    [history, fqn]
  );

  // Always keep this useEffect at first
  useEffect(() => {
    fetchResourcePermission();
  }, []);

  useEffect(() => {
    if (viewPermission) {
      fetchAlertDetails();
    }
  }, [viewPermission]);

  if (!loadingCount && !viewPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (!loadingCount && isUndefined(alertDetails)) {
    return <ErrorPlaceHolder className="m-0" />;
  }

  return (
    <ResizablePanels
      hideSecondPanel
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        children: loadingCount ? (
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
                  <Col span={21}>
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <EntityHeaderTitle
                          displayName={alertDetails?.displayName}
                          icon={alertIcon}
                          name={alertDetails?.name ?? ''}
                          serviceName=""
                        />
                      </Col>
                      <Col span={24}>
                        <div className="d-flex items-center flex-wrap gap-2">
                          {ownerLoading ? (
                            <Skeleton.Button
                              active
                              className="owner-skeleton"
                            />
                          ) : (
                            <OwnerLabel
                              hasPermission={editOwnersPermission}
                              owners={alertDetails?.owners}
                              onUpdate={onOwnerUpdate}
                            />
                          )}
                          <ExtraInfoLabel
                            label={t('label.total-entity', {
                              entity: t('label.event-plural'),
                            })}
                            value={0}
                          />
                          <ExtraInfoLabel
                            label={t('label.pending-entity', {
                              entity: t('label.event-plural'),
                            })}
                            value={0}
                          />
                        </div>
                      </Col>
                    </Row>
                  </Col>
                  <Col>
                    <Space align="center" size={8}>
                      {editPermission && (
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
                      )}
                      {deletePermission && (
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
                      )}
                    </Space>
                  </Col>
                </Row>
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

              <Col span={24}>
                <Tabs
                  activeKey={tab}
                  className="m-b-lg"
                  items={tabItems}
                  onTabClick={handleTabChange}
                />
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
      secondPanel={{
        children: <></>,
        minWidth: 0,
        className: 'content-resizable-panel-container',
      }}
    />
  );
}

export default AlertDetailsPage;
