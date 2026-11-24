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

import { Box, Card } from '@openmetadata/ui-core-components';
import { Bell01, Database01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import NoDataPlaceholder from '../../components/common/EmptyPlaceholder/NoDataPlaceholder';
import PermissionPlaceholder from '../../components/common/EmptyPlaceholder/PermissionPlaceholder';
import SomethingWentWrongPlaceholder from '../../components/common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ClientErrors } from '../../enums/Axios.enum';
import { ProviderType } from '../../generated/entity/events/notificationTemplate';
import { AlertType } from '../../generated/events/eventSubscription';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useIsAiMode } from '../../hooks/useAppMode';
import { AddObservabilityPageProps } from './AddObservabilityPage.interface';
import ObservabilityAlertForm from './components/ObservabilityAlertForm';
import { useAlertFormAccess } from './hooks/useAlertFormAccess';
import { useObservabilityAlertForm } from './hooks/useObservabilityAlertForm';

function AddObservabilityPage({
  alertType = AlertType.Observability,
}: Readonly<AddObservabilityPageProps>) {
  const { t } = useTranslation();
  const formState = useObservabilityAlertForm({ alertType });
  const { alert, alertError, breadcrumb, fetchAlert, isEditMode, isLoading } =
    formState;
  const isNotification = alertType === AlertType.Notification;
  const isAiMode = useIsAiMode();
  const { hasAccess, isPermissionLoading, permissionError, refreshPermission } =
    useAlertFormAccess(isEditMode);

  const getAlertLoadErrorPlaceholder = (status?: number) => {
    if (status === ClientErrors.NOT_FOUND) {
      return (
        <NoDataPlaceholder
          description={t('message.alert-not-found-description')}
          icon={<Bell01 className="tw:text-secondary" />}
          title={t('label.alert-not-found')}
        />
      );
    }

    if (status === ClientErrors.FORBIDDEN) {
      return (
        <PermissionPlaceholder
          permissionValue={t('label.edit-entity', {
            entity: t('label.alert'),
          })}
        />
      );
    }

    return <SomethingWentWrongPlaceholder onReload={fetchAlert} />;
  };

  const getAccessPlaceholder = () => {
    if (isPermissionLoading) {
      return <Loader />;
    }

    if (permissionError) {
      return (
        <Box className="tw:relative tw:min-h-[calc(100vh_-_16rem)] tw:w-full">
          <SomethingWentWrongPlaceholder onReload={refreshPermission} />
        </Box>
      );
    }

    if (!hasAccess) {
      return (
        <Box className="tw:relative tw:min-h-[calc(100vh_-_16rem)] tw:w-full">
          <PermissionPlaceholder
            permissionValue={t(
              isEditMode ? 'label.edit-entity' : 'label.create-entity',
              { entity: t('label.alert') }
            )}
          />
        </Box>
      );
    }

    return null;
  };

  const accessPlaceholder = getAccessPlaceholder();

  if (accessPlaceholder) {
    return accessPlaceholder;
  }

  // Only the edit route fetches an alert, and a retry clears the error first.
  if (alertError) {
    return (
      <Box className="tw:py-4" direction="col" gap={4}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
        <Box className="tw:relative tw:min-h-[calc(100vh_-_16rem)] tw:w-full">
          {getAlertLoadErrorPlaceholder(alertError.response?.status)}
        </Box>
      </Box>
    );
  }

  if (isLoading || (isEditMode && isEmpty(alert))) {
    return <Loader />;
  }

  if (alert?.provider === ProviderType.System) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
        <NoDataPlaceholder
          data-testid="no-data-placeholder"
          description={t('message.system-alert-edit-message')}
          icon={<Database01 />}
        />
      </div>
    );
  }

  return (
    <ResizablePanels
      hideSecondPanel
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container ',
        allowScroll: true,
        children: (
          <Card
            className={classNames('steps-form-container', {
              'tw:my-4': isAiMode,
            })}>
            <Card.Content>
              <ObservabilityAlertForm
                {...formState}
                shouldShowActionsSection={
                  !isNotification && formState.shouldShowActionsSection
                }
              />
            </Card.Content>
          </Card>
        ),
        minWidth: 700,
        flex: 0.7,
        wrapInCard: false,
      }}
      pageTitle={t('label.add-entity', {
        entity: t(
          isNotification ? 'label.notification-alert' : 'label.observability'
        ),
      })}
      secondPanel={{
        children: <></>,
        minWidth: 0,
        className: 'content-resizable-panel-container',
      }}
    />
  );
}

export default withPageLayout(AddObservabilityPage);
