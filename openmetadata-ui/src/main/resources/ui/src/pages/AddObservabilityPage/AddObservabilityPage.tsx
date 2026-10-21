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
  Card,
  EmptyPlaceholder,
  Typography,
} from '@openmetadata/ui-core-components';
import { Database01 } from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import { ProviderType } from '../../generated/entity/events/notificationTemplate';
import { AlertType } from '../../generated/events/eventSubscription';
import { withPageLayout } from '../../hoc/withPageLayout';
import { AddObservabilityPageProps } from './AddObservabilityPage.interface';
import ObservabilityAlertForm from './components/ObservabilityAlertForm';
import { useObservabilityAlertForm } from './hooks/useObservabilityAlertForm';

function AddObservabilityPage({
  alertType = AlertType.Observability,
}: Readonly<AddObservabilityPageProps>) {
  const { t } = useTranslation();
  const formState = useObservabilityAlertForm({ alertType });
  const { alert, isEditMode, isLoading } = formState;
  const isNotification = alertType === AlertType.Notification;

  if (isLoading || (isEditMode && isEmpty(alert))) {
    return <Loader />;
  }

  if (alert?.provider === ProviderType.System) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
        <EmptyPlaceholder
          data-testid="no-data-placeholder"
          footer={
            <>
              <Typography as="p" className="tw:max-w-md">
                {t('message.system-alert-edit-message')}
              </Typography>
            </>
          }
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
          <Card className="steps-form-container">
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
