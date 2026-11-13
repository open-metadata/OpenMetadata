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

import { Alert } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { MessagingProviderStatus } from '../../../../../generated/entity/teams/team';
import { getWebhookNotSendingReason } from '../../../../../utils/observability/alertStatus.utils';

interface WebhookNotSendingAlertProps {
  subscriptionStatus?: MessagingProviderStatus;
  slot?: string;
}

/** Says why the team's profile webhook in `slot` does not send, when the server reports it. */
function WebhookNotSendingAlert({
  subscriptionStatus,
  slot,
}: Readonly<WebhookNotSendingAlertProps>) {
  const { t } = useTranslation();
  const reason = getWebhookNotSendingReason(subscriptionStatus, slot);

  return reason ? (
    <Alert
      data-testid="subscription-not-sending"
      title={t('message.webhook-does-not-send-until-fixed')}
      variant="error">
      {reason}
    </Alert>
  ) : null;
}

export default WebhookNotSendingAlert;
