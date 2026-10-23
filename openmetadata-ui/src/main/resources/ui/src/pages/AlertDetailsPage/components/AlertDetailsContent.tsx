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

import {
  Box,
  ButtonUtility,
  Card,
  Owner,
  Skeleton,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Edit01,
  RefreshCw01,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import Description from '../../../components/common/EntityDescription/Description';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import EntityHeaderTitle from '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { AlertDetailTabs } from '../../../enums/Alerts.enum';
import { EntityType } from '../../../enums/entity.enum';
import { ProviderType } from '../../../generated/events/eventSubscription';
import { useVisitedTabs } from '../../../hooks/useVisitedTabs';
import { getRenderedActiveTab } from '../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import { hardDeleteEntity } from '../../../utils/DeleteWidget/DeleteWidgetUtils';
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
  const [isDeleting, setIsDeleting] = useState(false);
  const activeTab = getRenderedActiveTab(
    tabItems,
    tab,
    AlertDetailTabs.CONFIGURATION
  );
  // Keeps the recent events filter and page when switching tabs.
  const visitedTabs = useVisitedTabs(activeTab);
  const owners = alertDetails?.owners;
  const hasOwners = !isEmpty(owners);

  const renderOwners = () => {
    if (!hasOwners && !editOwnersPermission) {
      return null;
    }

    return (
      <Box
        align="center"
        className="tw:min-w-0 tw:shrink-0"
        data-testid="alert-owners"
        gap={2}>
        <Typography as="span" color="secondary" size="text-sm" weight="medium">
          {t('label.owner-plural')}
        </Typography>
        {hasOwners && <Owner owners={owners} />}
        {editOwnersPermission && (
          <UserTeamSelectableList
            hasPermission
            multiple={{ user: true, team: false }}
            owner={owners}
            onUpdate={onOwnerUpdate}
          />
        )}
      </Box>
    );
  };

  const handleAlertHardDelete = useCallback(async () => {
    setIsDeleting(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(alertDetails),
      alertDetails?.id ?? '',
      EntityType.SUBSCRIPTION
    );
    if (isSuccess) {
      handleAlertDelete();
    }
    hideDeleteModal();
    setIsDeleting(false);
  }, [alertDetails, handleAlertDelete, hideDeleteModal]);

  return (
    <Card
      className="steps-form-container"
      data-testid="alert-details-container">
      <Card.Content>
        <Box className="add-notification-container" direction="col" gap={4}>
          <div>
            <TitleBreadcrumb titleLinks={breadcrumb} />
          </div>

          <div>
            <Box justify="between">
              <div className="tw:w-5/6">
                <Box direction="col" gap={4}>
                  <div>
                    <EntityHeaderTitle
                      displayName={alertDetails?.displayName}
                      icon={alertIcon}
                      name={alertDetails?.name ?? ''}
                      serviceName=""
                    />
                  </div>
                  <div>
                    <div className="d-flex items-center flex-wrap gap-2">
                      {ownerLoading ? (
                        <Skeleton height={40} variant="rounded" width={80} />
                      ) : (
                        renderOwners()
                      )}
                      {extraInfo}
                    </div>
                  </div>
                </Box>
              </div>
              <div>
                <Box inline align="center" gap={1}>
                  <ButtonUtility
                    color="tertiary"
                    data-testid="sync-button"
                    icon={RefreshCw01}
                    isDisabled={isSyncing}
                    size="lg"
                    tooltip={t('label.sync-alert-offset', {
                      entity: t('label.alert'),
                    })}
                    onClick={handleAlertSync}
                  />
                  {editPermission &&
                    alertDetails?.provider !== ProviderType.System && (
                      <ButtonUtility
                        color="tertiary"
                        data-testid="edit-button"
                        icon={Edit01}
                        size="lg"
                        tooltip={t('label.edit-entity', {
                          entity: t('label.alert'),
                        })}
                        onClick={handleAlertEdit}
                      />
                    )}
                  {deletePermission &&
                    alertDetails?.provider !== ProviderType.System && (
                      <ButtonUtility
                        color="tertiary"
                        data-testid="delete-button"
                        icon={Trash01}
                        size="lg"
                        tooltip={t('label.delete-entity', {
                          entity: t('label.alert'),
                        })}
                        onClick={() => setShowDeleteModal(true)}
                      />
                    )}
                </Box>
              </div>
            </Box>
          </div>

          <div className="alert-description" data-testid="alert-description">
            <Description
              description={alertDetails?.description}
              entityType={EntityType.EVENT_SUBSCRIPTION}
              hasEditAccess={editDescriptionPermission}
              showCommentsIcon={false}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </div>

          <Tabs
            className="tw:gap-3"
            selectedKey={activeTab}
            onSelectionChange={(key) => handleTabChange(String(key))}>
            <Tabs.List size="sm" type="underline" variant="card">
              {tabItems.map(({ key, label }) => (
                <Tabs.Item id={key} key={key}>
                  {label}
                </Tabs.Item>
              ))}
            </Tabs.List>
            {tabItems.map(({ key, children }) => (
              <Tabs.Panel
                className="tw:data-inert:hidden"
                id={key}
                key={key}
                shouldForceMount={visitedTabs.has(key)}>
                {children}
              </Tabs.Panel>
            ))}
          </Tabs>
        </Box>
      </Card.Content>
      <DeleteModal
        entityTitle={getEntityName(alertDetails)}
        isDeleting={isDeleting}
        message={t('message.permanently-delete-common-message', {
          entity: getEntityName(alertDetails)?.toLowerCase?.() ?? '',
        })}
        open={showDeleteModal}
        onCancel={hideDeleteModal}
        onDelete={handleAlertHardDelete}
      />
    </Card>
  );
}

export default AlertDetailsContent;
