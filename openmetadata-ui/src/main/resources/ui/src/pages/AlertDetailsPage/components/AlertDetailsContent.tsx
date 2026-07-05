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

import { SyncOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Skeleton, Space, Tabs, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import DeleteWidgetModal from '../../../components/common/DeleteWidget/DeleteWidgetModal';
import DescriptionV1 from '../../../components/common/EntityDescription/DescriptionV1';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import EntityHeaderTitle from '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { ProviderType } from '../../../generated/events/eventSubscription';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { AlertDetailsContentProps } from '../AlertDetailsPage.interface';

function AlertDetailsContent({
  alertDetails,
  alertIcon,
  breadcrumb,
  deletePermission,
  editDescriptionPermission,
  editOwnersPermission,
  editPermission,
  extraInfo,
  handleAlertDelete,
  handleAlertEdit,
  handleAlertSync,
  handleTabChange,
  hideDeleteModal,
  isSyncing,
  onDescriptionUpdate,
  onOwnerUpdate,
  ownerLoading,
  setShowDeleteModal,
  showDeleteModal,
  tab,
  tabItems,
}: Readonly<AlertDetailsContentProps>) {
  const { t } = useTranslation();

  return (
    <Card
      className="steps-form-container"
      data-testid="alert-details-container">
      <Row className="add-notification-container" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumb} />
        </Col>

        <Col span={24}>
          <Row justify="space-between">
            <Col span={20}>
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
                      <Skeleton.Button active className="extra-info-skeleton" />
                    ) : (
                      <OwnerLabel
                        hasPermission={editOwnersPermission}
                        owners={alertDetails?.owners}
                        onUpdate={onOwnerUpdate}
                      />
                    )}
                    {extraInfo}
                  </div>
                </Col>
              </Row>
            </Col>
            <Col>
              <Space align="center" size={8}>
                <Tooltip
                  title={t('label.sync-alert-offset', {
                    entity: t('label.alert'),
                  })}>
                  <Button
                    className="flex flex-center"
                    data-testid="sync-button"
                    icon={<SyncOutlined height={16} width={16} />}
                    loading={isSyncing}
                    onClick={handleAlertSync}
                  />
                </Tooltip>
                {editPermission &&
                  alertDetails?.provider !== ProviderType.System && (
                    <Tooltip
                      title={t('label.edit-entity', {
                        entity: t('label.alert'),
                      })}>
                      <Button
                        className="flex flex-center"
                        data-testid="edit-button"
                        icon={
                          <EditIcon
                            color={DE_ACTIVE_COLOR}
                            height={16}
                            width={16}
                          />
                        }
                        onClick={handleAlertEdit}
                      />
                    </Tooltip>
                  )}
                {deletePermission &&
                  alertDetails?.provider !== ProviderType.System && (
                    <Tooltip
                      title={t('label.delete-entity', {
                        entity: t('label.alert'),
                      })}>
                      <Button
                        className="flex flex-center"
                        data-testid="delete-button"
                        icon={<DeleteIcon height={16} width={16} />}
                        onClick={() => setShowDeleteModal(true)}
                      />
                    </Tooltip>
                  )}
              </Space>
            </Col>
          </Row>
        </Col>

        <Col
          className="alert-description"
          data-testid="alert-description"
          span={24}>
          <DescriptionV1
            description={alertDetails?.description}
            entityType={EntityType.EVENT_SUBSCRIPTION}
            hasEditAccess={editDescriptionPermission}
            showCommentsIcon={false}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        </Col>

        <Col span={24}>
          <Tabs
            activeKey={tab}
            className="tabs-new"
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
        onCancel={hideDeleteModal}
      />
    </Card>
  );
}

export default AlertDetailsContent;
